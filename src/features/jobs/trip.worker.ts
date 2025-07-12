import { Job } from 'bullmq';
import { enrichLocationData } from '../../services/enrichment.service';
import logger from '../../utils/logger';


export const tripWorkerHandler = async(job: Job) => {
    logger.info(`Trip worker processing job '${job.name}' [${job.id}]`);
    switch (job.name) {
        case 'enrich-location-data':
            const { locationId } = job.data;
            if (!locationId) {
                throw new Error(`Job ${job.id} is missing required 'locationId' data.`);
            }
            await enrichLocationData(locationId);
            break;
        default:
            throw new Error(`Unknown job name in Trip queue: ${job.name}`)
    }
}

