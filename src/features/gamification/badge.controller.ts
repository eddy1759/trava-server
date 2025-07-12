import { Request, Response } from 'express';
import { BadgeCategory } from '@prisma/client';
import { BadgeService } from './badge.service';
import ApiError from '../../utils/ApiError';
import httpStatus from 'http-status-codes';
import { asyncWrapper } from '../../utils/asyncWrapper';

/**
 * @description A controller to handle all incoming HTTP requests for badge-related operations.
 */

/**
 * @description Controller to fetch all active badges.
 * @route GET /api/badges
 */
const getAllBadges = asyncWrapper(async (req: Request, res: Response) => {
    const badges = await BadgeService.getAllBadges();
    res.status(httpStatus.OK).json({
        success: true,
        message: 'Badges retrieved successfully.',
        data: badges,
    });
});

/**
 * @description Controller to fetch badges filtered by a specific category.
 * @route GET /api/badges/category/:category
 */
const getBadgesByCategory = asyncWrapper(async (req: Request, res: Response) => {
    // The category is guaranteed to be valid due to the validation middleware.
    const { category } = req.params;
    const badges = await BadgeService.getBadgesByCategory(category.toUpperCase() as BadgeCategory);
    res.status(httpStatus.OK).json({
        success: true,
        message: `Badges for category ${category} retrieved successfully.`,
        data: badges,
    });
});

/**
 * @description Controller to fetch all badges earned by a specific user.
 * @route GET /api/users/:userId/badges
 */
const getUserEarnedBadges = asyncWrapper(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const userBadges = await BadgeService.getUserEarnedBadges(userId);   

    res.status(httpStatus.OK).json({
        success: true,
        message: 'User earned badges retrieved successfully.',
        data: userBadges,
    });
});


/**
 * @description Controller to fetch statistics about a user's earned badges.
 * @route GET /api/users/:userId/badges/stats
 */
const getUserBadgeStats = asyncWrapper(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const stats = await BadgeService.getUserBadgeStats(userId);

    res.status(httpStatus.OK).json({
        success: true,
        message: 'User badge statistics retrieved successfully.',
        data: stats,
    });
});

/**
 * @description Controller to manually trigger an evaluation of a user's achievements.
 * This is useful for admin panels or debugging.
 * @route POST /api/users/:userId/badges/evaluate
 */
const evaluateUserAchievements = asyncWrapper(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const result = await BadgeService.evaluateUserAchievements(userId);
    
    res.status(httpStatus.OK).json({
        success: true,
        message: `Achievement evaluation for user ${userId} completed successfully. Newly earned badges have been awarded.`,
        data: result,
    });
});


export {
    getAllBadges,
    getBadgesByCategory,
    getUserEarnedBadges,
    getUserBadgeStats,
    evaluateUserAchievements,
};