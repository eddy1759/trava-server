import { Router } from 'express';
import { premiumController } from './premium.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validateBody } from '../../middlewares/validation.middleware';
import { premiumValidation } from './premium.validation';

const router = Router();

// Apply authentication to all premium routes
router.use(authMiddleware);

/**
 * @route GET /api/premium/tier-info
 * @desc Get user's current tier information and usage
 * @access Private
 */
router.get('/tier-info', premiumController.getUserTierInfo);

/**
 * @route GET /api/premium/feature-comparison
 * @desc Get feature comparison between free and premium tiers
 * @access Private
 */
router.get('/feature-comparison', premiumController.getFeatureComparison);

/**
 * @route GET /api/premium/subscription
 * @desc Get user's subscription details
 * @access Private
 */
router.get('/subscription', premiumController.getSubscriptionDetails);

/**
 * @route POST /api/premium/check-permission
 * @desc Check if user can perform a specific action
 * @access Private
 */
router.post(
  '/check-permission',
  validateBody(premiumValidation.checkActionPermission),
  premiumController.checkActionPermission
);

/**
 * @route POST /api/premium/track-ai-request
 * @desc Track AI request usage
 * @access Private
 */
router.post(
  '/track-ai-request',
  validateBody(premiumValidation.trackAIRequest),
  premiumController.trackAIRequest
);

/**
 * @route GET /api/premium/usage/:feature
 * @desc Get usage statistics for a specific feature
 * @access Private
 */
router.get('/usage/:feature', premiumController.getUsageStats);

/**
 * @route GET /api/premium/subscription-status
 * @desc Check if user has active subscription
 * @access Private
 */
router.get('/subscription-status', premiumController.checkSubscriptionStatus);

export default router; 