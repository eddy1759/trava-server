import { Job } from 'bullmq';
import { prisma } from '../../services/prisma';
import { getWeatherForLocation } from '../../services/weather.service';
import { cache } from '../../services/cache.service';
import logger from '../../utils/logger';

interface WeatherUpdateJob {
    locationId: string;
    lat: number;
    lng: number;
}

export const weatherWorkerHandler = async (job: Job) => {
    logger.info(`Weather worker processing job '${job.name}' [${job.id}]`);
    
    switch (job.name) {
        case 'update-weather':
            await handleUpdateWeather(job);
            break;
        case 'update-all-locations-weather':
            await handleUpdateAllLocationsWeather(job);
            break;
        default:
            throw new Error(`Unknown job name in Weather queue: ${job.name}`);
    }
};

async function handleUpdateWeather(job: Job<WeatherUpdateJob>) {
    const { locationId, lat, lng } = job.data;
    
    if (!locationId || !lat || !lng) {
        throw new Error(`Job ${job.id} is missing required location data.`);
    }

    logger.info(`Updating weather for location ${locationId} at ${lat}, ${lng}`);

    try {
        const weatherData = await getWeatherForLocation(lat, lng);
        
        if (!weatherData) {
            logger.warn(`No weather data received for location ${locationId}`);
            return;
        }

        // Cache weather data for 30 minutes
        const cacheKey = `weather:${locationId}`;
        await cache.set(cacheKey, weatherData, {
            ttl: 1800, // 30 minutes
            prefix: 'weather',
            tags: [`location:${locationId}`]
        });

        logger.info(`Weather cached successfully for location ${locationId}`);
    } catch (error) {
        logger.error(`Failed to update weather for location ${locationId}:`, error);
        throw error;
    }
}

async function handleUpdateAllLocationsWeather(job: Job) {
    logger.info('Starting bulk weather update for all locations');

    try {
        // Get all locations that need weather updates
        // Since we're not storing weather data in the database, we'll update all locations
        // The cache TTL will handle when data needs to be refreshed
        const locations = await prisma.location.findMany({
            select: {
                id: true,
                lat: true,
                lng: true
            }
        });

        logger.info(`Found ${locations.length} locations for weather updates`);

        // Process locations in batches to avoid overwhelming the weather API
        const batchSize = 10;
        for (let i = 0; i < locations.length; i += batchSize) {
            const batch = locations.slice(i, i + batchSize);
            
            await Promise.allSettled(
                batch.map(location => 
                    handleUpdateWeather({
                        id: job.id,
                        data: {
                            locationId: location.id,
                            lat: location.lat,
                            lng: location.lng
                        }
                    } as Job<WeatherUpdateJob>)
                )
            );

            // Small delay between batches to be respectful to the weather API
            if (i + batchSize < locations.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        logger.info('Bulk weather update completed successfully');
    } catch (error) {
        logger.error('Failed to update weather for all locations:', error);
        throw error;
    }
} 