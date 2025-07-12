import { prisma } from '../../services/prisma';
import logger from '../../utils/logger';
import { UserType, SubscriptionStatus } from '@prisma/client';
import { getFreeTierLimits, getPremiumTierLimits } from '../../middlewares/premium.middleware';
import { UsageStats, TierLimits, UserTierInfo } from './premium.types'
import ApiError from '../../utils/ApiError';


class PremiumService {
  private readonly tierLimits: TierLimits = {
    free: getFreeTierLimits(),
    premium: getPremiumTierLimits()
  };

  /**
   * Get comprehensive tier information for a user
   */
  async getUserTierInfo(userId: string): Promise<UserTierInfo> {
    try {
      const [user, subscription, usage] = await Promise.all([
          prisma.user.findUnique({ where: { id: userId, deleted: false }, select: { userType: true } }),
          this.getActiveSubscription(userId),
          this.getUserUsage(userId)
      ]);

      if (!user) {
        throw ApiError.NotFound('User not found');
      }

      const isPremium = !!subscription
      const limits = isPremium ? this.tierLimits.premium : this.tierLimits.free;
      
      const remaining: UsageStats = {
        trips: Math.max(0, limits.trips - usage.trips),
        ai_requests: Math.max(0, limits.ai_requests - usage.ai_requests),
        collaborators: Math.max(0, limits.collaborators - usage.collaborators),
        journal_entries: Math.max(0, limits.journal_entries - usage.journal_entries),
        photos: Math.max(0, limits.photos - usage.photos)
      };

      return {
        isPremium,
        currentUsage: usage,
        limits,
        remaining,
        subscriptionStatus: subscription?.status,
        subscriptionEndDate: subscription?.currentPeriodEnd
      };

    } catch (error) {
      logger.error('Error getting user tier info:', error);
      throw ApiError.InternalServerError("An eeror occurred trying to get user tier info")
    }
  }

  /**
     * Get the active subscription for a user.
     */
    async getActiveSubscription(userId: string) {
        return prisma.subscription.findFirst({
            where: {
                userId,
                status: SubscriptionStatus.ACTIVE
            },
            orderBy: { createdAt: 'desc' }
        });
    }

  /**
   * Get current usage statistics for a user
   */
  async getUserUsage(userId: string): Promise<UsageStats> {
    try {
      const [
        trips,
        collaborators,
        journalEntries,
        photos,
        aiRequests,
      ] = await Promise.all([
        prisma.trip.count({ where: { ownerId: userId, deleted: false } }),
        prisma.tripCollaborator.count({ where: { userId } }),
        prisma.journalEntry.count({ where: { userId } }),
        prisma.photo.count({ where: { journalEntry: { userId } } }),
        this.getAIRequestCount(userId), // Call the implemented method
      ]);

      return {
        trips,
        collaborators,
        journal_entries: journalEntries,
        photos,
        ai_requests: aiRequests,
      };

    } catch (error) {
      logger.error('Error getting user usage:', error);
      throw ApiError.InternalServerError("An eeror occurred trying to get user tier info")
    }
  }

  /**
   * Check if user can perform an action based on their tier
   */
  async canPerformAction(
    userId: string, 
    action: keyof UsageStats, 
    quantity: number = 1
  ): Promise<{ allowed: boolean; reason?: string; remaining?: number }> {
    try {
      const tierInfo = await this.getUserTierInfo(userId);
      const currentUsage = tierInfo.currentUsage[action];
      const limit = tierInfo.limits[action];
      const remaining = tierInfo.remaining[action];

      if (currentUsage + quantity > limit) {
        return {
          allowed: false,
          reason: `You've reached the ${action} limit for your tier. Upgrade to premium for higher limits.`,
          remaining
        };
      }

      return { allowed: true, remaining: remaining - quantity };

    } catch (error) {
      logger.error('Error checking action permission:', error);
      return { allowed: false, reason: 'Error checking permissions' };
    }
  }

  /**
   * Track AI request usage
   */
  async trackAIRequest(userId: string, requestType: string): Promise<void> {
    try {
        await prisma.aIRequestLog.create({
            data: {
                userId,
                requestType,
            }
        });
        logger.info(`AI request tracked for user ${userId}: ${requestType}`);
    } catch (error) {
        logger.error('Error tracking AI request:', error);
    }
  }

  /**
   * Get AI request count for a user (placeholder implementation)
   */
  private async getAIRequestCount(userId: string): Promise<number> {
    // For a monthly limit, you'd calculate the start of the current month.
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await prisma.aIRequestLog.count({
      where: {
        userId,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
    });
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: { in: [SubscriptionStatus.ACTIVE] }
        }
      });

      return !!subscription;

    } catch (error) {
      logger.error('Error checking subscription status:', error);
      return false;
    }
  }

  /**
   * Get subscription details for a user
   */
  async getSubscriptionDetails(userId: string) {
    try {
      const subscription = await prisma.subscription.findFirst({
        where: { userId },
        include: {
          plan: true
        },
        orderBy: { createdAt: 'desc' }
      });

      return subscription;

    } catch (error) {
      logger.error('Error getting subscription details:', error);
      return null;
    }
  }

  /**
   * Get feature comparison between free and premium tiers
   */
  getFeatureComparison() {
    return {
      free: {
        trips: '3 trips',
        ai_requests: '10 AI requests/month',
        collaborators: '2 collaborators per trip',
        journal_entries: '10 journal entries',
        photos: '10 photos',
        features: [
          'Basic trip planning',
          'Simple expense tracking',
          'Limited AI suggestions',
          'Basic itinerary management',
          'Community features',
          'Basic Trip Statistics'
        ]
      },
      premium: {
        trips: 'Unlimited trips',
        ai_requests: '1000 AI requests/month',
        collaborators: '50 collaborators per trip',
        journal_entries: 'Unlimited journal entries',
        photos: '10,000 photos',
        features: [
          'Advanced AI-powered planning',
          'Detailed expense analytics',
          'Advanced itinerary features',
          'Advance AI Smart Budget and Recommendation',
          'Priority support',
          'Export capabilities',
          'Advanced collaboration tools',
          'Custom trip templates',
          'Advanced reporting',
          'Advance Trip Statistics',
        ]
      }
    };
  }

  /**
   * Check if user should be upgraded to premium
   * This could be called after successful payment processing
   */
  async upgradeUserToPremium(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { userType: UserType.PREMIUM }
      });

      logger.info(`User ${userId} upgraded to premium`);
    } catch (error) {
      logger.error('Error upgrading user to premium:', error);
      throw error;
    }
  }

  /**
   * Downgrade user to free tier
   * This could be called when subscription expires or is cancelled
   */
  async downgradeUserToFree(userId: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { userType: UserType.FREE }
      });

      logger.info(`User ${userId} downgraded to free tier`);
    } catch (error) {
      logger.error('Error downgrading user to free:', error);
      throw error;
    }
  }
}

export const premiumService = new PremiumService(); 