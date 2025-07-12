import { startEmailJobProcessor } from './emailJob.processor'
import logger from '../../utils/logger'


export const startBackgroundJobs = async () => {
    try {
        await Promise.all([
            startEmailJobProcessor(), // Start the email job processor
        ])
        logger.info('All background processes started successfully.');
    } catch (error) {
        logger.error('Error starting background jobs:', error);
        throw error; // Rethrow to propagate the error
    }
}