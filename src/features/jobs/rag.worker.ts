import { Job } from 'bullmq';
import { prisma } from '../../services/prisma';
import { generateEmbeddings } from '../../services/embedding.service';
import logger from '../../utils/logger';
import { PointOfInterest, Destination } from '@prisma/client';

/**
 * Handles embedding for new Points of Interest (POIs).
 * Your implementation using raw SQL is correct for unsupported vector types.
 */
async function handleEmbedNewPois(job: Job): Promise<void> {
    const { locationId } = job.data;
    if (!locationId) {
        throw new Error(`Job [${job.id}] 'embed-new-pois' is missing a locationId.`);
    }

    // Fetch POIs that do not have an embedding yet using raw SQL.
    const poisToEmbed: PointOfInterest[] = await prisma.$queryRaw`
        SELECT * FROM "PointOfInterest"
        WHERE "locationId" = ${locationId} AND embedding IS NULL;
    `;

    if (poisToEmbed.length === 0) {
        logger.info(`No new POIs to embed for location [${locationId}]. Job complete.`);
        return;
    }

    const documents = poisToEmbed.map(
        poi => `Name: ${poi.name}. Category: ${poi.category}. Description: ${poi.description || 'N/A'}`
    );

    const embeddings = await generateEmbeddings(documents);

    // Use a transaction to update all POIs with their new embeddings.
    await prisma.$transaction(
        poisToEmbed.map((poi, index) => {
            const embeddingString = `[${embeddings[index].join(',')}]`; // Format for pgvector
            return prisma.$executeRaw`
                UPDATE "PointOfInterest"
                SET embedding = ${embeddingString}::vector
                WHERE id = ${poi.id};
            `;
        })
    );

    logger.info(`Successfully stored embeddings for ${poisToEmbed.length} POIs in location [${locationId}].`);
}

/**
 * Handles embedding for new curated Destinations.
 */
async function handleEmbedDestination(job: Job): Promise<void> {
    const { destinationId } = job.data;
    if (!destinationId) {
        throw new Error(`Job [${job.id}] 'embed-destination' is missing a destinationId.`);
    }

    const destinations: (Destination & { embedding: unknown })[] = await prisma.$queryRaw`
        SELECT * FROM "Destination"
        WHERE id = ${destinationId};
    `;

    const destination = destinations[0] ?? null;


    if (!destination) {
        throw new Error(`Destination with ID ${destinationId} not found for embedding.`);
    }

     if (destination.embedding) {
        logger.info(`Destination ${destination.name} already has an embedding. Skipping.`);
        return;
    }

    const documentText = `Destination: ${destination.name}. Country: ${destination.country}. Description: ${destination.description}. Best time to visit: ${destination.bestTimeToVisit || 'anytime'}.`;
    
    const [embedding] = await generateEmbeddings([documentText]);
    
    if (!embedding) {
        throw new Error(`Failed to generate embedding for destination ${destinationId}.`);
    }

    const embeddingString = `[${embedding.join(',')}]`;
    await prisma.$executeRaw`
        UPDATE "Destination"
        SET embedding = ${embeddingString}::vector
        WHERE id = ${destination.id};
    `;

    logger.info(`Successfully stored embedding for destination: ${destination.name}`);
}

/**
 * Main handler for the RAG worker. Delegates jobs based on their name.
 */
export const ragWorkerHandler = async (job: Job) => {
    logger.info(`RAG Worker processing job '${job.name}' [${job.id}]`);
    switch (job.name) {
        case 'embed-new-pois':
            await handleEmbedNewPois(job);
            break;
        case 'embed-destination':
            await handleEmbedDestination(job);
            break;
        default:
            throw new Error(`Unknown job name in RAG queue: ${job.name}`);
    }
};