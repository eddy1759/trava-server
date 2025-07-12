import { Router } from 'express';
import * as BadgeController from './badge.controller';
import { validateParams } from '../../middlewares/validation.middleware';
import { authMiddleware, adminOnly } from '../../middlewares/auth';
// Assuming validation schemas are in a 'badge.validation.ts' file in this directory
import { badgeValidationSchemas } from './badge.validation'; 

const badgeRouter = Router();

/**
 * @description API routes for badge-related functionalities.
 * Provides endpoints for public badge information and user-specific achievements.
 */

// --- Public Badge Routes ---

/**
 * @route   GET /api/badges
 * @desc    Get a list of all active badges in the system.
 * @access  Public
 */
badgeRouter.get('/', BadgeController.getAllBadges);

/**
 * @route   GET /api/badges/category/:category
 * @desc    Get badges filtered by a specific category.
 * @access  Public
 * @example /api/badges/category/TRAVEL_MILESTONES
 */
badgeRouter.get(
    '/category/:category',
    validateParams(badgeValidationSchemas.getBadgesByCategory),
    BadgeController.getBadgesByCategory
);

// --- User-Specific Badge Routes ---

/**
 * @route   GET /api/users/:userId/badges
 * @desc    Get all badges earned by a specific user.
 * @access  Protected
 */
badgeRouter.get(
    '/users/:userId/badges',
    authMiddleware,
    validateParams(badgeValidationSchemas.getUserBadges),
    BadgeController.getUserEarnedBadges
);

/**
 * @route   GET /api/users/:userId/badges/stats
 * @desc    Get statistics about a user's badges (total points, count by category/rarity).
 * @access  Protected
 */
badgeRouter.get(
    '/users/:userId/badges/stats',
    authMiddleware,
    validateParams(badgeValidationSchemas.getUserBadges),
    BadgeController.getUserBadgeStats
);

/**
 * @route   POST /api/users/:userId/badges/evaluate
 * @desc    Manually trigger a re-evaluation of a user's achievements.
 * @access  Admin/Protected - This should be protected by an authentication/authorization middleware.
 */
badgeRouter.post(
    '/users/:userId/badges/evaluate',
    authMiddleware,
    adminOnly,
    validateParams(badgeValidationSchemas.evaluateAchievements),
    BadgeController.evaluateUserAchievements
);


export default badgeRouter;
