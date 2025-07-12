import { cache } from './cache.service';
import logger from '../utils/logger';
import CONFIG from '../config/env';

export interface AICostConfig {
    maxTokensPerRequest: number;
    maxRequestsPerMinute: number;
    cacheTTL: number;
    useCheaperModel: boolean;
    batchRequests: boolean;
}

export interface AIRequest {
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    userId: string;
    priority: 'low' | 'medium' | 'high';
}

// Extended interface for queued requests with Promise handlers
interface QueuedAIRequest extends AIRequest {
    resolve: (value: string) => void;
    reject: (reason: any) => void;
}

export interface AICostStats {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    cacheHits: number;
    cacheMisses: number;
    averageResponseTime: number;
}

class AICostOptimizer {
    private requestQueue: QueuedAIRequest[] = [];
    private processingQueue = false;
    private stats: AICostStats = {
        totalRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageResponseTime: 0,
    };

    private readonly config: AICostConfig = {
        maxTokensPerRequest: 1000,
        maxRequestsPerMinute: 60,
        cacheTTL: 3600, // 1 hour
        useCheaperModel: true,
        batchRequests: true,
    };

    /**
     * Optimizes AI request by checking cache first and using cost-effective models
     */
    async optimizeRequest(request: AIRequest): Promise<string> {
        const startTime = Date.now();
        
        try {
            // Check cache first
            const cacheKey = this.generateCacheKey(request);
            const cachedResponse = await cache.get<string>(cacheKey, 'ai');
            
            if (cachedResponse) {
                this.stats.cacheHits++;
                logger.info(`AI cache hit for user ${request.userId}`);
                return cachedResponse;
            }

            this.stats.cacheMisses++;

            // Apply cost optimizations
            const optimizedRequest = this.optimizeRequestParams(request);
            
            // Process request
            const response = await this.processRequest(optimizedRequest);
            
            // Cache the response
            await cache.set(cacheKey, response, {
                ttl: this.config.cacheTTL,
                prefix: 'ai',
                tags: [`user:${request.userId}`, 'ai-response'],
            });

            // Update stats
            const responseTime = Date.now() - startTime;
            this.updateStats(optimizedRequest, responseTime);

            return response;
        } catch (error) {
            logger.error('AI request optimization failed:', error);
            throw error;
        }
    }

    /**
     * Generates cache key for AI request
     */
    private generateCacheKey(request: AIRequest): string {
        const hash = require('crypto').createHash('md5');
        const keyData = `${request.prompt}-${request.model}-${request.maxTokens}-${request.temperature}`;
        return hash.update(keyData).digest('hex');
    }

    /**
     * Optimizes request parameters for cost efficiency
     */
    private optimizeRequestParams(request: AIRequest): AIRequest {
        const optimized = { ...request };

        // Use cheaper model for low priority requests
        if (this.config.useCheaperModel && request.priority === 'low') {
            optimized.model = 'gpt-3.5-turbo-instruct';
        }

        // Limit tokens for cost control
        if (!optimized.maxTokens || optimized.maxTokens > this.config.maxTokensPerRequest) {
            optimized.maxTokens = this.config.maxTokensPerRequest;
        }

        // Use lower temperature for more focused responses
        if (!optimized.temperature) {
            optimized.temperature = 0.2;
        }

        return optimized;
    }

    /**
     * Processes AI request with rate limiting
     */
    private async processRequest(request: AIRequest): Promise<string> {
        // Check rate limits
        await this.checkRateLimit(request.userId);

        // Add to queue if batching is enabled
        if (this.config.batchRequests && request.priority === 'low') {
            return this.addToBatchQueue(request);
        }

        // Process immediately for high priority requests
        return this.executeRequest(request);
    }

    /**
     * Checks rate limits for user
     */
    private async checkRateLimit(userId: string): Promise<void> {
        const key = `rate_limit:ai:${userId}`;
        const currentCount = await cache.get<number>(key, 'rate_limit') || 0;

        if (currentCount >= this.config.maxRequestsPerMinute) {
            throw new Error('Rate limit exceeded for AI requests');
        }

        await cache.set(key, currentCount + 1, {
            ttl: 60, // 1 minute
            prefix: 'rate_limit',
        });
    }

    /**
     * Adds request to batch queue
     */
    private async addToBatchQueue(request: AIRequest): Promise<string> {
        return new Promise((resolve, reject) => {
            this.requestQueue.push({
                ...request,
                resolve,
                reject,
            });

            if (!this.processingQueue) {
                this.processBatchQueue();
            }
        });
    }

    /**
     * Processes batch queue
     */
    private async processBatchQueue(): Promise<void> {
        this.processingQueue = true;

        while (this.requestQueue.length > 0) {
            const batch = this.requestQueue.splice(0, 10); // Process 10 at a time
            
            try {
                await Promise.all(
                    batch.map(async (request) => {
                        try {
                            const response = await this.executeRequest(request);
                            request.resolve(response);
                        } catch (error) {
                            request.reject(error);
                        }
                    })
                );
            } catch (error) {
                logger.error('Batch processing failed:', error);
            }

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        this.processingQueue = false;
    }

    /**
     * Executes the actual AI request
     */
    private async executeRequest(request: AIRequest): Promise<string> {
        // This would integrate with your actual AI service
        // For now, we'll simulate the request
        logger.info(`Executing AI request for user ${request.userId} with model ${request.model}`);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        return `AI response for: ${request.prompt.substring(0, 50)}...`;
    }

    /**
     * Updates cost statistics
     */
    private updateStats(request: AIRequest, responseTime: number): void {
        this.stats.totalRequests++;
        this.stats.totalTokens += request.maxTokens || 0;
        this.stats.averageResponseTime = 
            (this.stats.averageResponseTime * (this.stats.totalRequests - 1) + responseTime) / this.stats.totalRequests;
        
        // Calculate cost (approximate)
        const costPerToken = request.model?.includes('gpt-4') ? 0.00003 : 0.000002;
        this.stats.totalCost += (request.maxTokens || 0) * costPerToken;
    }

    /**
     * Gets cost statistics
     */
    getStats(): AICostStats {
        return { ...this.stats };
    }

    /**
     * Resets cost statistics
     */
    resetStats(): void {
        this.stats = {
            totalRequests: 0,
            totalTokens: 0,
            totalCost: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageResponseTime: 0,
        };
    }

    /**
     * Updates configuration
     */
    updateConfig(newConfig: Partial<AICostConfig>): void {
        Object.assign(this.config, newConfig);
        logger.info('AI cost optimizer configuration updated:', this.config);
    }
}

// Export singleton instance
export const aiCostOptimizer = new AICostOptimizer();

// Export convenience functions
export const optimizeAIRequest = (request: AIRequest) => aiCostOptimizer.optimizeRequest(request);
export const getAICostStats = () => aiCostOptimizer.getStats();
export const resetAICostStats = () => aiCostOptimizer.resetStats();
export const updateAIConfig = (config: Partial<AICostConfig>) => aiCostOptimizer.updateConfig(config); 