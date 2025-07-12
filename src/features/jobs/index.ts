import { Worker, Job, WorkerOptions } from 'bullmq';
import { redisService } from '../../services/redis';
import IORedis from 'ioredis';
import logger from '../../utils/logger';
import CONFIG from '../../config/env';

import { tripWorkerHandler } from './trip.worker';
import { ragWorkerHandler } from './rag.worker';
import { photoWorkerHandler } from './photo.worker';
import { contentModerationWorkerHandler } from './content.moderation.worker';
import { weatherWorkerHandler } from './weather.worker';
import { notificationWorkerHandler } from './notification.worker';
import { aiOptimizationWorkerHandler } from './ai.optimization.worker';
import { enrichmentWorkerHandler } from './enrichment.worker';

import { 
    tripQueue, 
    ragQueue, 
    photoQueue, 
    contentModerationQueue, 
    weatherQueue, 
    notificationQueue, 
    aiOptimizationQueue,
    enrichmentQueue
} from './queue';

// Wrap initialization in an async function to use await
async function initializeWorkers() {
    try {
        // --- FIX: Connect to Redis from within the worker process ---
        logger.info('[BullMQ-Worker] Attempting to connect to Redis...');
        await redisService.connect();
        logger.info('[BullMQ-Worker] Redis connection successful.');

        // This IORedis instance is specifically for BullMQ and is correct.
        const connection = new IORedis(CONFIG.REDIS_URL, {
            maxRetriesPerRequest: null, // Important for BullMQ stability
        });

        const workerOpts: WorkerOptions = {
            connection: connection,
            concurrency: parseInt(process.env.BULLMQ_WORKER_CONCURRENCY || '5', 10),
        };

        // Initialize all workers
        const tripWorker = new Worker('trip-queue', tripWorkerHandler, workerOpts);
        const ragWorker = new Worker('rag-queue', ragWorkerHandler, workerOpts);
        const photoWorker = new Worker('photo-queue', photoWorkerHandler, workerOpts);
        const contentModerationWorker = new Worker('content-moderation-queue', contentModerationWorkerHandler, workerOpts);
        const weatherWorker = new Worker('weather-queue', weatherWorkerHandler, workerOpts);
        const notificationWorker = new Worker('notification-queue', notificationWorkerHandler, workerOpts);
        const aiOptimizationWorker = new Worker('ai-optimization-queue', aiOptimizationWorkerHandler, workerOpts);
        const enrichmentWorker = new Worker('enrichment-queue', enrichmentWorkerHandler, workerOpts);

        const workers = [
            tripWorker, 
            ragWorker, 
            photoWorker, 
            contentModerationWorker, 
            weatherWorker, 
            notificationWorker, 
            aiOptimizationWorker,
            enrichmentWorker
        ];

        // Monitoring: Log queue stats periodically
        async function logQueueStats() {
            try {
                const [tripCounts, ragCounts, photoCounts, moderationCounts, weatherCounts, notificationCounts, aiCounts, enrichmentCounts] = await Promise.all([
                    tripQueue.getJobCounts(),
                    ragQueue.getJobCounts(),
                    photoQueue.getJobCounts(),
                    contentModerationQueue.getJobCounts(),
                    weatherQueue.getJobCounts(),
                    notificationQueue.getJobCounts(),
                    aiOptimizationQueue.getJobCounts(),
                    enrichmentQueue.getJobCounts(),
                ]);
                
                logger.info(`[BullMQ-Worker] Queue stats:`, {
                    trip: tripCounts,
                    rag: ragCounts,
                    photo: photoCounts,
                    moderation: moderationCounts,
                    weather: weatherCounts,
                    notification: notificationCounts,
                    ai: aiCounts,
                    enrichment: enrichmentCounts
                });
            } catch (err) {
                logger.error('[BullMQ-Worker] Error fetching queue stats:', err);
            }
        }

        setInterval(logQueueStats, 60_000);

        workers.forEach(worker => {
            worker.on('completed', (job: Job) => {
                logger.info(`[${worker.name}] Job ${job.id} completed successfully.`);
            });

            worker.on('failed', (job: Job | undefined, error: Error) => {
                if (job) {
                    logger.error(`[${worker.name}] Job ${job.id} failed after ${job.attemptsMade} attempts with reason: ${error.message}`);
                } else {
                    logger.error(`[${worker.name}] A job failed, but job data is undefined. Error: ${error.message}`);
                }
            });

            worker.on('error', err => {
                logger.error(`A worker [${worker.name}] reported an error:`, err);
            });
        });

        logger.info('[BullMQ-Worker] All workers have been initialized and are listening for jobs...');

    } catch (error) {
        logger.error('[BullMQ-Worker] Failed to initialize workers:', error);
        process.exit(1); // Exit if worker initialization fails
    }
}

process.on('SIGINT', async () => {
    logger.info('[BullMQ-Worker] SIGINT received: Graceful shutdown initiated.');
    await redisService.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('[BullMQ-Worker] SIGTERM received: Graceful shutdown initiated.');
    await redisService.disconnect();
    process.exit(0);
});

// Start the initialization process
initializeWorkers();