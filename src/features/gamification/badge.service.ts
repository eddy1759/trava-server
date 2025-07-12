import { Badge, BadgeCategory, BadgeRarity} from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import { prisma } from '../../services/prisma';
import logger from '../../utils/logger';
import { fetchUserStats, checkAndAwardBadges } from './badge.utils';
import ApiError from '../../utils/ApiError';

/**
 * The main entry point for evaluating a user's achievements.
 * This function should be called after any significant user action
 * (e.g., completing a trip, creating a journal entry, making a trip public).
 * It orchestrates fetching stats and checking for new badges.
 *
 * @param userId - The ID of the user to evaluate.
 */
async function evaluateUserAchievements(userId: string): Promise<void> {
    try {
        logger.info(`Starting achievement evaluation for user: ${userId}`);
        // 1. Fetch all user statistics in one go.
        const userStats = await fetchUserStats(userId);
        logger.debug(`User stats for ${userId}:`, userStats);

        // 2. Check all unearned badges against the stats and award if necessary.
        await checkAndAwardBadges(userId, userStats);
        logger.info(`Finished achievement evaluation for user: ${userId}`);
    } catch (error) {
        logger.error(`An error occurred during achievement evaluation for user ${userId}:`, error);
        // Depending on the application, you might want to re-throw or handle differently.
    }
}

/**
 * Retrieves all active badges from the database, sorted for display.
 * @returns A promise that resolves to an array of Badge objects.
 */
async function getAllBadges(): Promise<Badge[]> {
    return prisma.badge.findMany({
        where: { isActive: true },
        orderBy: [
            { category: 'asc' },
            { rarity: 'asc' },
            { points: 'desc' },
        ],
    });
}

/**
 * Retrieves all active badges of a specific category.
 * @param category - The category to filter by.
 * @returns A promise that resolves to an array of Badge objects.
 */
async function getBadgesByCategory(category: BadgeCategory): Promise<Badge[]> {
    return prisma.badge.findMany({
        where: {
            category,
            isActive: true,
        },
        orderBy: [
            { rarity: 'asc' },
            { points: 'desc' },
        ],
    });
}

/**
 * Retrieves all badges a specific user has earned.
 * @param userId - The ID of the user.
 * @returns A promise that resolves to an array of UserBadge objects with the related Badge details.
 */
async function getUserEarnedBadges(userId: string) {
    const userBadges = await prisma.userBadge.findMany({
        where: { userId },
        include: {
            badge: true,
        },
        orderBy: { earnedAt: 'desc' },
    });

    return userBadges;
}

/**
 * Retrieves comprehensive statistics about a user's badges and points.
 * @param userId - The ID of the user.
 */
async function getUserBadgeStats(userId: string) {
    const userPromise = await prisma.user.findUnique({
        where: { id: userId },
        select: { totalPoints: true },
    });

    if (!userPromise) {
        throw ApiError.NotFound(`User with ID ${userId} not found.`);
    }

    const userBadges = await prisma.userBadge.findMany({
        where: { userId },
        include: { badge: true}
    });

    const categoryStats: Partial<Record<BadgeCategory, number>> = {};
    const rarityStats: Partial<Record<BadgeRarity, number>> = {};
    let totalBadges = 0;

    

    for (const userBadge of userBadges) {
        const category = userBadge.badge.category;
        const rarity = userBadge.badge.rarity;
        categoryStats[category] = (categoryStats[category] || 0) + 1;
        rarityStats[rarity] = (rarityStats[rarity] || 0) + 1;
        totalBadges += 1;
    }

    return {
        totalBadges,
        totalPoints: userPromise.totalPoints,
        categoryStats,
        rarityStats,
    };
}


// Export all functions as part of a BadgeService object
export const BadgeService = {
    evaluateUserAchievements,
    getAllBadges,
    getBadgesByCategory,
    getUserEarnedBadges,
    getUserBadgeStats,
};