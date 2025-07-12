import { Job } from 'bullmq';
import logger  from '../../utils/logger';
import { enrichLocationData } from '../../services/enrichment.service';

interface EnrichmentJobData {
    locationId: string;
}

export async function enrichmentWorkerHandler(job: Job<EnrichmentJobData>) {
    const { locationId } = job.data;
    
    logger.info(`[Enrichment Worker] Starting enrichment for location ID: ${locationId}`);
    
    try {
        await enrichLocationData(locationId);
        logger.info(`[Enrichment Worker] Successfully completed enrichment for location ID: ${locationId}`);
    } catch (error) {
        logger.error(`[Enrichment Worker] Failed to enrich location ID: ${locationId}:`, error);
        throw error; // Re-throw to trigger retry mechanism
    }
} 