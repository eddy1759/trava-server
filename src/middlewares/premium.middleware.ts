import { Request, Response, NextFunction, RequestHandler } from 'express';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { prisma } from '../services/prisma';
import { SubscriptionStatus } from '@prisma/client';
import { premiumService } from '../features/premium/premium.service';

export interface PremiumFeatureConfig {
  featureName: string;
  customMessage?: string;
}

/**
 * Middleware to check if user has premium access
 * This checks both the JWT token and verifies subscription status in database
 */
export const requirePremium = (config: PremiumFeatureConfig): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {

        if (!req.user) {
            return next(ApiError.Unauthorized('Authentication required'));
        }

        try {
            const subscription = await prisma.subscription.findFirst({
                where: {
                    userId: req.user.id,
                    status: SubscriptionStatus.ACTIVE
                }
            });

            if (!subscription) {
                logger.warn(`User ${req.user.id} attempted to access premium feature "${config.featureName}" without an active subscription.`);
                return next(ApiError.Forbidden(
                    config.customMessage || 'This is a premium feature. Please upgrade your plan to get access.'
                ));
            }

            // Attach subscription info to the request for downstream use
            (req as any).subscription = subscription;
            next();
        } catch (error) {
            logger.error('Error in requirePremium middleware:', error);
            return next(ApiError.InternalServerError('Error verifying premium access'));
        }
    };
};

type UsageLimitType = keyof Awaited<ReturnType<typeof premiumService.getUserUsage>>;

/**
 * Middleware to check if a user is within their usage limits for a specific feature.
 */
export const checkSubscriptionLimits = (limitType: UsageLimitType): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {

        if (!req.user) {
            return next(ApiError.Unauthorized('Authentication required'));
        }

        try {
            const { allowed, reason } = await premiumService.canPerformAction(req.user.id, limitType);

            if (!allowed) {
                return next(ApiError.Forbidden(reason));
            }

            next();
        } catch (error) {
            logger.error('Error in checkSubscriptionLimits middleware:', error);
            return next(ApiError.InternalServerError('Error checking usage limits'));
        }
    };
};


/**
 * Get current usage for a specific limit type
 */
async function getCurrentUsage(userId: string, limitType: string): Promise<number> {
  switch (limitType) {
    case 'trips':
      return await prisma.trip.count({
        where: { ownerId: userId, deleted: false }
      });
    
    case 'ai_requests':
      // This would need to be tracked in a separate table
      return 0; // Placeholder
    
    case 'collaborators':
      return await prisma.tripCollaborator.count({
        where: { userId }
      });
    
    default:
      return 0;
  }
}

/**
 * Get premium limits for different features
 */
function getPremiumLimit(limitType: string): number {
  switch (limitType) {
    case 'trips':
      return 100; // Premium users can have 100 trips
    case 'ai_requests':
      return 1000; // 1000 AI requests per month
    case 'collaborators':
      return 50; // 50 collaborators per trip
    default:
      return 1000;
  }
}

/**
 * Get free tier limits
 */
export function getFreeTierLimits() {
  return {
    trips: 5,
    ai_requests: 50,
    collaborators: 3,
    journal_entries: 10,
    photos: 50
  };
}

/**
 * Get premium tier limits
 */
export function getPremiumTierLimits() {
  return {
    trips: 100,
    ai_requests: 1000,
    collaborators: 50,
    journal_entries: 1000,
    photos: 10000
  };
}

/**
 * Middleware to add usage information to response headers
 */
/**
 * Middleware to add usage information to response headers.
 * This can be used for informational purposes on the frontend.
 */
export const addUsageHeaders = (limitType: UsageLimitType): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {

        if (req.user) {
            try {
                const tierInfo = await premiumService.getUserTierInfo(req.user.id);
                const limit = tierInfo.limits[limitType] ?? 0;
                const currentUsage = tierInfo.currentUsage[limitType] ?? 0;

                res.set({
                    'X-Usage-Current': currentUsage.toString(),
                    'X-Usage-Limit': limit.toString(),
                    'X-Usage-Remaining': Math.max(0, limit - currentUsage).toString(),
                    'X-User-Tier': tierInfo.isPremium ? 'premium' : 'free'
                });
            } catch (error) {
                logger.error('Error setting usage headers:', error);
            }
        }

        next();
    };
};