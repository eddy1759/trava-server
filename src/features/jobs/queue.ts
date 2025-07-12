import { Queue, DefaultJobOptions } from 'bullmq';
import IORedis from 'ioredis';
import { redisService } from '../../services/redis' // Assuming your robust redis.ts is in services/
import logger from '../../utils/logger';
import CONFIG from '../../config/env';

const connection = new IORedis(CONFIG.REDIS_URL, {
    maxRetriesPerRequest: null, // Important for BullMQ stability
});

const defaultJobOptions: DefaultJobOptions = {
    attempts: 3, // Retry a failed job up to 3 times
    backoff: {
        type: 'exponential', // Use exponential backoff for retries
        delay: 5000, // The initial delay is 2 seconds
    },
    removeOnComplete: {
        count: 1000, 
    },
    removeOnFail: {
        count: 5000,
    },
};

// Core queues
export const tripQueue = new Queue('trip-queue', {
    connection,
    defaultJobOptions,
});

export const ragQueue = new Queue('rag-queue', {
    connection,
    defaultJobOptions,
});

// New queues for missing features
export const photoQueue = new Queue('photo-queue', {
    connection,
    defaultJobOptions,
});

export const contentModerationQueue = new Queue('content-moderation-queue', {
    connection,
    defaultJobOptions,
});

export const weatherQueue = new Queue('weather-queue', {
    connection,
    defaultJobOptions,
});

export const notificationQueue = new Queue('notification-queue', {
    connection,
    defaultJobOptions,
});

export const aiOptimizationQueue = new Queue('ai-optimization-queue', {
    connection,
    defaultJobOptions,
});

export const enrichmentQueue = new Queue('enrichment-queue', {
    connection,
    defaultJobOptions,
});

// --- Logging for confirmation ---
logger.info('BullMQ queues initialized: trip-queue, rag-queue, photo-queue, content-moderation-queue, weather-queue, notification-queue, ai-optimization-queue, enrichment-queue');

tripQueue.on('error', (error) => logger.error('Error in trip-queue:', error));
ragQueue.on('error', (error) => logger.error('Error in rag-queue:', error));
photoQueue.on('error', (error) => logger.error('Error in photo-queue:', error));
contentModerationQueue.on('error', (error) => logger.error('Error in content-moderation-queue:', error));
weatherQueue.on('error', (error) => logger.error('Error in weather-queue:', error));
notificationQueue.on('error', (error) => logger.error('Error in notification-queue:', error));
aiOptimizationQueue.on('error', (error) => logger.error('Error in ai-optimization-queue:', error));
enrichmentQueue.on('error', (error) => logger.error('Error in enrichment-queue:', error));