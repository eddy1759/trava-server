import { Job } from 'bullmq';
import { optimizeAIRequest, getAICostStats } from '../../services/ai-cost-optimizer';
import { generateTravelResponse } from '../../services/rag.service';
import { cache } from '../../services/cache.service';
import logger from '../../utils/logger';

interface AIOptimizationJob {
    userId: string;
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    priority: 'low' | 'medium' | 'high';
    useRAG?: boolean;
    context?: string;
}

interface RAGQueryJob {
    userId: string;
    query: string;
    context: string;
    liveContext?: string;
}

export const aiOptimizationWorkerHandler = async (job: Job) => {
    logger.info(`AI optimization worker processing job '${job.name}' [${job.id}]`);
    
    switch (job.name) {
        case 'optimize-ai-request':
            await handleOptimizeAIRequest(job);
            break;
        case 'process-rag-query':
            await handleRAGQuery(job);
            break;
        case 'batch-ai-requests':
            await handleBatchAIRequests(job);
            break;
        default:
            throw new Error(`Unknown job name in AI Optimization queue: ${job.name}`);
    }
};

async function handleOptimizeAIRequest(job: Job<AIOptimizationJob>) {
    const { userId, prompt, model, maxTokens, temperature, priority, useRAG, context } = job.data;
    
    logger.info(`Processing AI request for user ${userId} with priority ${priority}`);

    try {
        let response: string;

        if (useRAG && context) {
            // Use RAG service for context-aware responses
            response = await generateTravelResponse({
                userQuery: prompt,
                retrievedContext: context,
                liveContext: undefined
            });
        } else {
            // Use standard AI optimization
            response = await optimizeAIRequest({
                prompt,
                model,
                maxTokens,
                temperature,
                userId,
                priority
            });
        }

        // Cache the response for future similar queries
        const cacheKey = `ai_response:${userId}:${Buffer.from(prompt).toString('base64').substring(0, 50)}`;
        await cache.set(cacheKey, response, {
            ttl: 3600, // 1 hour
            prefix: 'ai',
            tags: [`user:${userId}`, 'ai-response']
        });

        // Log cost statistics
        const stats = getAICostStats();
        logger.info(`AI request completed for user ${userId}. Cost stats:`, stats);

        logger.info(`AI request processed successfully for user ${userId}`);
        return response;
    } catch (error) {
        logger.error(`Failed to process AI request for user ${userId}:`, error);
        throw error;
    }
}

async function handleRAGQuery(job: Job<RAGQueryJob>) {
    const { userId, query, context, liveContext } = job.data;
    
    logger.info(`Processing RAG query for user ${userId}`);

    try {
        const response = await generateTravelResponse({
            userQuery: query,
            retrievedContext: context,
            liveContext
        });

        // Cache the RAG response
        const cacheKey = `rag_response:${userId}:${Buffer.from(query).toString('base64').substring(0, 50)}`;
        await cache.set(cacheKey, response, {
            ttl: 1800, // 30 minutes
            prefix: 'rag',
            tags: [`user:${userId}`, 'rag-response']
        });

        logger.info(`RAG query processed successfully for user ${userId}`);
        return response;
    } catch (error) {
        logger.error(`Failed to process RAG query for user ${userId}:`, error);
        throw error;
    }
}

async function handleBatchAIRequests(job: Job) {
    const { requests } = job.data;
    
    logger.info(`Processing batch of ${requests.length} AI requests`);

    try {
        const results = await Promise.allSettled(
            requests.map((request: AIOptimizationJob) => 
                handleOptimizeAIRequest({
                    id: job.id,
                    data: request
                } as Job<AIOptimizationJob>)
            )
        );

        const successful = results.filter(result => result.status === 'fulfilled').length;
        const failed = results.filter(result => result.status === 'rejected').length;

        logger.info(`Batch AI processing completed: ${successful} successful, ${failed} failed`);
        
        return results;
    } catch (error) {
        logger.error(`Failed to process batch AI requests:`, error);
        throw error;
    }
} 