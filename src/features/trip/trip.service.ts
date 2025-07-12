import { prisma } from '../../services/prisma';
import { TripStatus, CollaboratorRole } from '@prisma/client';
import * as locationService from '../../features/location/location.service';
import ApiError from '../../utils/ApiError';
import { tripQueue, weatherQueue, notificationQueue, contentModerationQueue } from '../jobs/queue'; 
import logger from '../../utils/logger';
import { CreateTripData } from './trip.types';


interface TripNotificationData {
    tripId: string;
    tripName: string;
    collaboratorIds: string[];
}

/**
 * Creates a new trip, finds or creates its location, and adds the owner as an
 * editor in a single, atomic database transaction.
 */
async function createTrip(data: CreateTripData, ownerId: string) {
    console.log(data)
    const { tripName, startDate, endDate, description, destinationQuery } = data;

    // Validate date range
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;
    
    if (end && start > end) {
        throw ApiError.BadRequest('Start date cannot be after end date');
    }

    // Step 1: Find or create the location OUTSIDE the transaction (to avoid timeout)
    const location = await locationService.findOrCreateLocation(destinationQuery);
    if (!location) {
        throw ApiError.InternalServerError('Failed to find or create a location for the trip.');
    }

    // Step 2: Use a transaction for DB operations only
    const trip = await prisma.$transaction(async (tx) => {
        // Create the trip itself
        const newTrip = await tx.trip.create({
            data: {
                tripName,
                description,
                startDate: start,
                endDate: end,
                tripStatus: TripStatus.DRAFT,
                ownerId: ownerId,
                locationId: location.id,
            },
            include: {
                location: true,
            },
        });

        // Add the owner as an EDITOR of their own trip.
        await tx.tripCollaborator.create({
            data: {
                tripId: newTrip.id,
                userId: ownerId,
                role: CollaboratorRole.EDITOR,
            },
        });
        return newTrip;
    });

    // Step 4: Queue background jobs
    try {
        // Queue location enrichment
        if (trip && trip.location) {
            await tripQueue.add('enrich-location-data', { locationId: trip.location.id });
            logger.info(`Queued location [${trip.location.id}] for enrichment for new trip [${trip.id}]`);
        }

        // Queue weather update for the location
        if (trip.location) {
            await weatherQueue.add('update-weather', {
                locationId: trip.location.id,
                lat: trip.location.lat,
                lng: trip.location.lng
            });
            logger.info(`Queued weather update for location [${trip.location.id}]`);
        }

        // Queue notification for trip creation
        await notificationQueue.add('send-notification', {
            userId: ownerId,
            type: 'trip_update',
            title: 'Trip Created Successfully',
            message: `Your trip "${tripName}" has been created and is ready for planning.`,
            data: { tripId: trip.id, tripName },
            priority: 'medium'
        });

    } catch (error) {
        logger.error('Failed to queue background jobs for trip creation:', error);
    }

    return trip;
}

/**
 * Retrieves a single trip by its ID, but only if the specified user is a collaborator.
 * @param tripId The ID of the trip to retrieve.
 * @param userId The ID of the user requesting the trip.
 */
async function getTripById(tripId: string, userId: string) {
    // A single, more efficient, and CORRECT query.
    const trip = await prisma.trip.findFirst({
        where: {
            id: tripId,
            // This clause ensures the trip is only returned if the user is in the collaborators list.
            collaborators: {
                some: {
                    userId: userId,
                },
            },
        },
        include: {
            location: true,
            collaborators: {
                include: {
                    user: {
                        select: { id: true, fullName: true },
                    },
                },
            },
        },
    });

    if (!trip) {
        // This will now correctly trigger for non-existent trips OR trips the user has no access to.
        throw ApiError.NotFound(`Trip not found or you do not have permission to view it.`);
    }

    return trip;
}

// Get all trips by user with paignation, sorting and filtering, user has to be the owner or has an editor colloraborator role
async function getTripsByUser(
    userId: string,
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
    filterByStatus?: TripStatus
) {
    const whereClause: any = {
        OR: [
            { ownerId: userId },
            { collaborators: { some: { userId, role: CollaboratorRole.EDITOR } } }
        ]
    };

    if (filterByStatus) {
        whereClause.tripStatus = filterByStatus;
    }

    const validSortFields = ['createdAt', 'updatedAt', 'tripName', 'startDate', 'endDate'];
    const safeSortBy = validSortFields.includes(sortBy as string) ? (sortBy as string) : 'createdAt';

    const trips = await prisma.trip.findMany({
        where: whereClause,
        include: {
            location: true,
            collaborators: {
                include: {
                    user: {
                        select: { id: true, fullName: true },
                    },
                },
            },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
    });

    return trips;
}

/**
 * Updates trip status and triggers relevant notifications
 */
async function updateTripStatus(tripId: string, userId: string, newStatus: TripStatus) {
    
    const tripForValidation = await prisma.trip.findFirst({
        where: {
            id: tripId,
            OR: [
                { ownerId: userId },
                { collaborators: { some: { userId: userId, role: 'EDITOR' } } }
            ],
        },
        select: {
            tripStatus: true,
            endDate: true,
        },
    });

    if (!tripForValidation) {
        throw ApiError.NotFound('Trip not found or you do not have permission to modify it.');
    }

    const { tripStatus: currentStatus, endDate } = tripForValidation;

    if (currentStatus === newStatus) {
        return { id: tripId, tripStatus: newStatus };
    }

    switch (newStatus) {
        case TripStatus.COMPLETED:
            if (currentStatus !== TripStatus.ACTIVE) {
                throw ApiError.BadRequest('Trip can only be marked as COMPLETED if it is currently ACTIVE.');
            }
            // Corrected logic: The error message implies completion can only happen *before* the end date passes.
            // if (endDate && new Date() > new Date(endDate)) {
            //     throw ApiError.BadRequest('A trip cannot be marked COMPLETED after its end date has passed.');
            // }
            break;

        case TripStatus.CANCELLED:
            if (!([TripStatus.ACTIVE, TripStatus.DRAFT] as TripStatus[]).includes(currentStatus)) {
                throw ApiError.BadRequest('Trip can only be cancelled if it is currently ACTIVE or in DRAFT.');
            }
            break;

        case TripStatus.ACTIVE:
            if (currentStatus !== TripStatus.DRAFT) {
                throw ApiError.BadRequest('A trip can only be activated from the DRAFT status.');
            }
            break;
        // default:
        //     throw ApiError.BadRequest(`Invalid status transition from ${currentStatus} to ${newStatus}.`);
    }

    const updatedTrip = await prisma.trip.update({
        where: { id: tripId },
        data: { tripStatus: newStatus },
        select: { id: true, tripStatus: true } // Only select what is needed for the return value.
    });

    const notificationData = await getTripNotificationData(tripId);
    if (notificationData) {
        queueTripNotification(notificationData, newStatus);
    }

    return updatedTrip;
}

async function updateTripPrivacy(tripId: string, userId: string, privacy: string) {
    // Use a single query with an OR condition for authorization
    const trip = await prisma.trip.findFirst({
        where: {
            id: tripId,
            OR: [
                { ownerId: userId }, // User is the owner
                {
                    // User is a collaborator with the EDITOR role
                    collaborators: {
                        some: {
                            userId: userId,
                            role: CollaboratorRole.EDITOR
                        }
                    }
                }
            ]
        }
    });

    // If the query returns nothing, the user is not authorized OR the trip doesn't exist.
    if (!trip) {
        throw ApiError.NotFound('Trip not found or you do not have permission to change its privacy');
    }

    const newPrivacyStatus = privacy === 'true';

    if (trip.isPublic === newPrivacyStatus) {
        return trip; // No change needed
    }

    return prisma.trip.update({
        where: { id: tripId },
        data: { isPublic: newPrivacyStatus },
    });
}


async function getTripNotificationData(tripId: string): Promise<TripNotificationData | null> {
    const trip = await prisma.trip.findUnique({
        where: { id: tripId },
        select: {
            tripName: true,
            collaborators: {
                select: { userId: true }
            }
        }
    });

    if (!trip) return null;

    return {
        tripId,
        tripName: trip.tripName,
        collaboratorIds: trip.collaborators.map(c => c.userId)
    };
}



async function queueTripNotification(data: TripNotificationData, status: TripStatus): Promise<void> {
    try {
        await notificationQueue.add('send-bulk-notification', {
            userIds: data.collaboratorIds,
            type: 'trip_update',
            title: 'Trip Status Updated',
            message: `Trip "${data.tripName}" status has been updated to ${status}.`,
            data: { tripId: data.tripId, tripName: data.tripName, status },
            priority: 'medium'
        });
    } catch (error) {
        logger.error(`Failed to queue notification for trip ${data.tripId}:`, error);
        // Do not re-throw the error, as failing to notify should not fail the API call.
    }
}

export const tripService = {
    createTrip,
    getTripById,
    updateTripStatus,
    updateTripPrivacy,
    getTripsByUser
};

// // ... after updating trip status
// const userTripCount = await prisma.trip.count({ where: { ownerId: trip.ownerId, status: 'ACTIVE' }});
// if (userTripCount === 1) {
//     await awardBadge(trip.ownerId, 'FIRST_TRIP');
// }


// ... after updating trip status
// const completedTrips = await prisma.trip.findMany({ 
//     where: { ownerId: trip.ownerId, status: 'COMPLETED' },
//     include: { location: true }
// });
// const distinctCountries = new Set(completedTrips.map(t => t.location.countryCode));
// if (distinctCountries.size >= 5) {
//     await awardBadge(trip.ownerId, 'GLOBETROTTER_5');
// }