import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { premiumService } from './premium.service';
import ApiError from '../../utils/ApiError';
import logger from '../../utils/logger';
import { asyncWrapper } from '../../utils/asyncWrapper';

class PremiumController {
  /**
   * Get user's current tier information and usage
   */
  getUserTierInfo = asyncWrapper(async (req: Request, res: Response) => {
        const userId = req.user.id;
        const tierInfo = await premiumService.getUserTierInfo(userId);
        res.status(StatusCodes.OK).json({ success: true, data: tierInfo });
    });

  /**
   * Get feature comparison between free and premium tiers
   */
  getFeatureComparison = asyncWrapper(async (req: Request, res: Response) => {
        const comparison = premiumService.getFeatureComparison();
        res.status(StatusCodes.OK).json({ success: true, data: comparison });
    });

  /**
   * Get user's subscription details
   */
  getSubscriptionDetails = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const subscription = await premiumService.getSubscriptionDetails(userId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: subscription
    });
  });

  /**
   * Check if user can perform a specific action
   */
  checkActionPermission = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { action, quantity = 1 } = req.body;

    // if (!userId) {
    //   return next(ApiError.Unauthorized('User ID not found'));
    // }

    // // Additional validation
    // if (quantity < 1 || quantity > 1000) {
    //   return next(ApiError.BadRequest('Quantity must be between 1 and 1000'));
    // }

    const result = await premiumService.canPerformAction(userId, action, quantity);

    res.status(StatusCodes.OK).json({
      success: true,
      data: result
    });
  });

  /**
   * Track AI request usage
   */
  trackAIRequest = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user?.id;
    const { requestType } = req.body;

    // if (!userId) {
    //   return next(ApiError.Unauthorized('User ID not found'));
    // }

    // Sanitize requestType
    const sanitizedRequestType = requestType?.toString().slice(0, 100) || 'unknown';

    await premiumService.trackAIRequest(userId, sanitizedRequestType);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'AI request tracked successfully'
    });
  });

  /**
   * Get usage statistics for a specific feature
   */
  getUsageStats = asyncWrapper(async (req: Request, res: Response, next: NextFunction) => {
      const userId = req.user.id;
      const { feature } = req.params;

      const tierInfo = await premiumService.getUserTierInfo(userId);
      const validFeatures = Object.keys(tierInfo.currentUsage);

      if (!validFeatures.includes(feature)) {
          return next(ApiError.BadRequest('Invalid feature specified.'));
      }

      const featureKey = feature as keyof typeof tierInfo.currentUsage;
      const current = tierInfo.currentUsage[featureKey];
      const limit = tierInfo.limits[featureKey];
      const remaining = tierInfo.remaining[featureKey];

      res.status(StatusCodes.OK).json({
          success: true,
          data: {
              feature,
              current,
              limit,
              remaining,
              percentage: limit > 0 ? Math.round((current / limit) * 100) : 0
          }
      });
  });

  
  /**
   * Check if user has active subscription
   */
  checkSubscriptionStatus = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user?.id;

    const hasActiveSubscription = await premiumService.hasActiveSubscription(userId);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        hasActiveSubscription,
        isPremium: req.user.isProUser,
        userId: userId
      }
    });
  });
}

export const premiumController = new PremiumController(); 