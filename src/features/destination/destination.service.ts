
import { prisma } from '../../services/prisma';
import { Destination } from '@prisma/client';
import * as locationService from '../location/location.service';
import * as embeddingService from '../../services/embedding.service';
import logger from '../../utils/logger';
import { ragQueue } from '../jobs/queue';



type CreateDestinationData = {
    name: string;
    country: string;
    description: string;
    imageUrl: string;
    locationQuery: string;
    bestTimeToVisit?: string;
};

type UpdateDestinationData = Partial<CreateDestinationData>;


export async function createDestination(data: CreateDestinationData): Promise<Destination> {
    const { locationQuery, ...destinationData } = data;

    const location = await locationService.findOrCreateLocation(locationQuery);

    const newDestination = await prisma.destination.create({
        data: {
            ...destinationData,
            locationId: location.id,
        },
        include: { location: true },
    });

    await ragQueue.add('embed-destination', { destinationId: newDestination.id });
    return newDestination;
}

export async function updateDestination(id: string, data: UpdateDestinationData): Promise<Destination> {
    const { locationQuery, ...destinationData } = data;
    let locationId: string | undefined;

    if (locationQuery) {
        const newLocation = await locationService.findOrCreateLocation(locationQuery);
        locationId = newLocation.id;
    }

    return prisma.destination.update({
        where: { id },
        data: {
            ...destinationData,
            ...(locationId && { locationId }),
        },
        include: { location: true },
    });
}

export async function getAllDestinations(options: { page: number; limit: number }): Promise<{ destinations: Destination[], total: number }> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [destinations, total] = await prisma.$transaction([
        prisma.destination.findMany({
            skip,
            take: limit,
            include: { location: true },
            orderBy: { name: 'asc' },
        }),
        prisma.destination.count(),
    ]);
    
    return { destinations, total };
}

export async function searchDestinations(query: string, limit: number): Promise<Destination[]> {
    try {
        const queryVector = await embeddingService.generateEmbeddings([query]);
        if (!queryVector || queryVector.length === 0) {
            throw new Error('Failed to generate query vector.');
        }

        const vector = queryVector[0];
        
        const result: Destination[] = await prisma.$queryRaw`
            SELECT * FROM "Destination"
            ORDER BY embedding <=> ${vector}::vector
            LIMIT ${limit};
        `;
        
        logger.info(`RAG search successful for query: "${query}"`);
        return result;

    } catch (error) {
        logger.warn(`RAG search failed for query "${query}", falling back to text search. Error: ${error}`);
        
        return prisma.destination.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { country: { contains: query, mode: 'insensitive' } },
                ],
            },
            include: { location: true },
            take: limit,
        });
    }
}
