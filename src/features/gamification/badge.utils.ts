import { prisma } from '../../services/prisma';
import { BadgeSlug, TripStatus, Badge, Prisma } from '@prisma/client'
import logger from '../../utils/logger';


export interface UserStats {
    completedTrips: number;
    distinctCountries: number;
    publicTrips: number;
    totalPhotoLikes: number;      // UPDATED
    totalPhotoComments: number;
    budgetTrips: number;
    totalSavings: number;
    journalEntries: number;
    photos: number;
}

/**
 * Fetches all relevant statistics for a user in a single, efficient query.
 * This prevents multiple database calls when checking for various badges.
 * @param userId - The ID of the user to fetch stats for.
 * @returns A promise that resolves to the UserStats object.
 */
export async function fetchUserStats(userId: string): Promise<UserStats> {
    const baseTripWhere = { ownerId: userId, deleted: false };

    const userPhotosWhere = { photo: { journalEntry: { userId: userId, deleted: false } } };

    const [
        completedTrips,
        publicTrips,
        journalEntries,
        totalPhotoLikes,    // UPDATED
        totalPhotoComments, // UPDATED
        countryData,
        budgetData,
        photoCount,
    ] = await Promise.all([
        prisma.trip.count({ where: { ...baseTripWhere, tripStatus: TripStatus.COMPLETED } }),
        prisma.trip.count({ where: { ...baseTripWhere, isPublic: true } }),
        prisma.journalEntry.count({ where: { trip: { ...baseTripWhere } } }),
        prisma.photoLike.count({ where: userPhotosWhere }),
        prisma.photoComment.count({ where: userPhotosWhere }),
        prisma.trip.findMany({
            where: { ...baseTripWhere, tripStatus: TripStatus.COMPLETED, location: { isNot: null } },
            select: { location: { select: { countryCode: true } } },
            distinct: ['locationId'],
        }),
        prisma.trip.findMany({
            where: { ...baseTripWhere, tripStatus: TripStatus.COMPLETED, estimatedBudget: { gt: 0 } },
            select: {
                estimatedBudget: true,
                expenses: { select: { amount: true } },
            },
        }),
        prisma.photo.count({ where: { journalEntry: { trip: { ...baseTripWhere } } } }),
    ]);

    let budgetTrips = 0;
    let totalSavings = 0;
    for (const trip of budgetData) {
        if (trip.estimatedBudget) {
            const totalExpenses = trip.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
            if (trip.estimatedBudget.gte(totalExpenses)) {
                budgetTrips++;
                totalSavings += (Number(trip.estimatedBudget) - totalExpenses);
            }
        }
    }

    const distinctCountries = new Set(countryData.map(t => t.location!.countryCode).filter(Boolean) as string[]);

    return {
        completedTrips,
        publicTrips,
        journalEntries,
        totalPhotoLikes,    // UPDATED
        totalPhotoComments, // UPDATED
        distinctCountries: distinctCountries.size,
        budgetTrips,
        totalSavings,
        photos: photoCount,
    };
}


/**
 * Awards a specific badge to a user if they don't already have it.
 * This function is atomic, ensuring the user's points are updated along with the badge creation.
 * @param userId - The ID of the user to award the badge to.
 * @param badge - The full badge object to be awarded.
 * @param tx - The Prisma transaction client.
 */
async function awardBadgeInTransaction(userId: string, badge: Badge, tx?: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) {
    const existingUserBadge = await tx.userBadge.findUnique({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
    });

    if (existingUserBadge) {
        // This can happen in near-simultaneous checks. It's not an error.
        logger.info(`User ${userId} already has badge ${badge.name}. Skipping award.`);
        return;
    }

    await tx.userBadge.create({
        data: {
            userId,
            badgeId: badge.id,
            earnedAt: new Date(),
        },
    });

    await tx.user.update({
        where: { id: userId },
        data: {
            totalPoints: {
                increment: badge.points,
            },
        },
    });

    logger.info(`Awarded badge "${badge.name}" to user ${userId}.`);

    // await notificationService.sendBadgeEarnedNotification(userId, badge.id);
}


/**
 * A map of badge slugs to their corresponding checker functions.
 * Each function takes the user's stats and the badge's criteria and returns a boolean.
 * This approach is data-driven and avoids large if/else or switch statements.
 */
const badgeCheckers: Record<BadgeSlug, (stats: UserStats, criteria: any) => boolean> = {
    // Travel Milestones
    FIRST_TRIP: (stats, criteria) => stats.completedTrips >= (criteria.completedTrips || 1),
    FREQUENT_TRIP: (stats, criteria) => stats.completedTrips >= (criteria.completedTrips || 5),
    WORLD_WANDERER: (stats, criteria) => stats.distinctCountries >= (criteria.distinctCountries || 15),
    LEGENDARY_NOMAD: (stats, criteria) => stats.distinctCountries >= (criteria.distinctCountries || 50),

    // Social Engagement
    SOCIAL_STARTER: (stats, criteria) => stats.publicTrips >= (criteria.publicTrips || 1),
    SOCIAL_INFLUENCER: (stats, criteria) => stats.publicTrips >= (criteria.publicTrips || 15),
    TRAVEL_AMBASSADOR: (stats, criteria) =>
        stats.publicTrips >= (criteria.publicTrips || 50) && stats.totalPhotoLikes >= (criteria.totalPhotoLikes || 200),
    ENGAGEMENT_STAR: (stats, criteria) => stats.totalPhotoComments >= (criteria.totalPhotoComments || 100),

    // Financial Planning
    BUDGET_TRAVELER: (stats, criteria) => stats.budgetTrips >= (criteria.budgetTrips || 1),
    FINANCIAL_NINJA: (stats, criteria) => stats.budgetTrips >= (criteria.budgetTrips || 10),
    SAVINGS_MASTERMIND: (stats, criteria) => stats.totalSavings >= (criteria.totalSavings || 10000),

    // Content Creation
    FIRST_JOURNAL_ENTRY: (stats, criteria) => stats.journalEntries >= (criteria.journalEntries || 5),
    STORYTELLER: (stats, criteria) => stats.journalEntries >= (criteria.journalEntries || 20),
    PHOTOGRAPHER: (stats, criteria) => stats.photos >= (criteria.photos || 50),
    CREATOR_LEGEND: (stats, criteria) =>
        stats.journalEntries >= (criteria.journalEntries || 100) && stats.photos >= (criteria.photos || 200),
    VISUAL_STORYTELLER: (stats, criteria) => stats.photos >= (criteria.photos || 100),
};

/**
 * Checks all unearned badges for a user and awards them if the criteria are met.
 * @param userId - The user to evaluate.
 * @param userStats - The pre-fetched statistics for the user.
 */
export async function checkAndAwardBadges(userId: string, userStats: UserStats): Promise<void> {
    const earnedBadges = await prisma.userBadge.findMany({
        where: { userId },
        select: { badgeId: true }, 
    });

    const earnedBadgeIds = new Set(earnedBadges.map(b => b.badgeId));

    const potentialBadges = await prisma.badge.findMany({
        where: {
            isActive: true,
            id: {
                notIn: Array.from(earnedBadgeIds),
            },
        }
    });

    if (potentialBadges.length === 0) {
        logger.info(`No unearned badges found for user ${userId}.`);
        return;
    }

    const badgesToAward: Badge[] = [];
    for (const badge of potentialBadges) {
        const checker = badgeCheckers[badge.slug];
        if (checker) {
            try {
                // The criteria from the DB is of type JsonValue, we cast it to any
                const criteria = badge.criteria as any;
                if (checker(userStats, criteria)) {
                    badgesToAward.push(badge);
                }
            } catch (error) {
                logger.error(`Error checking badge ${badge.slug} for user ${userId}:`, error);
            }
        }
    }

    if (badgesToAward.length > 0) {
        logger.info(`User ${userId} is eligible for ${badgesToAward.length} new badge(s). Awarding now...`);
        await prisma.$transaction(async (tx) => {
            for (const badge of badgesToAward) {
                await awardBadgeInTransaction(userId, badge, tx);
            }
        });
        logger.info(`Awarded badges to user ${userId}: ${badgesToAward.map(b => b.name).join(", ")}`);
    } 
}