# Premium Features Implementation Strategy

## 🎯 **Product Engineering Overview**

This document outlines the strategic implementation of premium features in the Trava travel platform, integrating with the existing Stripe payment system and user tier management.

## 🏗️ **Architecture Components**

### 1. **Premium Middleware** (`src/middlewares/premium.middleware.ts`)
- **`requirePremium()`** - Gates access to premium-only features
- **`checkSubscriptionLimits()`** - Enforces usage limits based on tier
- **`addUsageHeaders()`** - Provides usage information in response headers

### 2. **Premium Service** (`src/services/premium.service.ts`)
- **Tier Management** - Handles user tier information and limits
- **Usage Tracking** - Monitors feature usage across the platform
- **Subscription Verification** - Validates active subscriptions

### 3. **Premium API** (`src/features/premium/`)
- **Tier Information** - Get user's current tier and usage
- **Feature Comparison** - Compare free vs premium features
- **Usage Statistics** - Track and display usage metrics

## 🚀 **Implementation Strategy**

### **Phase 1: Core Premium Infrastructure** ✅
- [x] Premium middleware for feature gating
- [x] Premium service for tier management
- [x] Premium API endpoints
- [x] Integration with existing auth system

### **Phase 2: Feature-Specific Gating**
- [x] Trip creation limits (5 for free, unlimited for premium)
- [ ] AI request limits (50/month free, 1000/month premium)
- [ ] Storage limits (100MB free, 10GB premium)
- [ ] Collaborator limits (3 free, 50 premium)
- [ ] Journal entry limits (10 free, unlimited premium)
- [ ] Photo limits (50 free, 10,000 premium)

### **Phase 3: Premium-Only Features**
- [ ] Advanced AI planning
- [ ] Export capabilities
- [ ] Priority support
- [ ] Custom trip templates
- [ ] Advanced analytics

## 📊 **Tier Limits Configuration**

### **Free Tier Limits**
```typescript
{
  trips: 5,
  ai_requests: 50,
  storage: 100 * 1024 * 1024, // 100MB
  collaborators: 3,
  journal_entries: 10,
  photos: 50
}
```

### **Premium Tier Limits**
```typescript
{
  trips: 100, // Effectively unlimited
  ai_requests: 1000,
  storage: 10 * 1024 * 1024 * 1024, // 10GB
  collaborators: 50,
  journal_entries: 1000, // Effectively unlimited
  photos: 10000
}
```

## 🔧 **How to Implement Premium Gating**

### **1. Basic Premium Feature Gating**
```typescript
// In your route file
import { requirePremium } from '../../middlewares/premium.middleware';

// Premium-only feature
router.post('/premium-feature', 
  requirePremium({ featureName: 'advanced_ai_planning' }),
  controller.premiumFeatureHandler
);
```

### **2. Usage-Based Gating**
```typescript
// In your route file
import { checkSubscriptionLimits, addUsageHeaders } from '../../middlewares/premium.middleware';

// Feature with usage limits
router.post('/limited-feature',
  addUsageHeaders('ai_requests'),
  checkSubscriptionLimits('ai_requests', 50), // Free tier limit
  controller.limitedFeatureHandler
);
```

### **3. Service-Level Checks**
```typescript
// In your service
import { premiumService } from '../../services/premium.service';

async function someFeature(userId: string) {
  const canPerform = await premiumService.canPerformAction(userId, 'ai_requests', 1);
  
  if (!canPerform.allowed) {
    throw new ApiError.Forbidden(canPerform.reason);
  }
  
  // Proceed with feature
}
```

## 🎯 **Feature Implementation Examples**

### **Example 1: Trip Creation with Limits**
```typescript
// src/features/trip/trip.routes.ts
router.post('/', 
  addUsageHeaders('trips'),
  checkSubscriptionLimits('trips', 5), // Free users: 5 trips
  validateBody(createTripSchema), 
  tripController.createTripHandler
);
```

### **Example 2: AI-Powered Planning (Premium Only)**
```typescript
// src/features/itinerary/itinerary.routes.ts
router.post('/ai-suggestions',
  requirePremium({ 
    featureName: 'ai_planning',
    customMessage: 'Upgrade to premium for AI-powered trip planning!'
  }),
  itineraryController.generateAISuggestions
);
```

### **Example 3: Advanced Analytics (Premium Only)**
```typescript
// src/features/analytics/analytics.routes.ts
router.get('/advanced-stats',
  requirePremium({ featureName: 'advanced_analytics' }),
  analyticsController.getAdvancedStats
);
```

## 📈 **Usage Tracking & Analytics**

### **Response Headers**
Premium-gated endpoints automatically include usage headers:
```
X-Usage-Current: 3
X-Usage-Limit: 5
X-Usage-Remaining: 2
X-User-Tier: free
```

### **Usage Statistics API**
```typescript
// GET /api/premium/usage/trips
{
  "success": true,
  "data": {
    "feature": "trips",
    "current": 3,
    "limit": 5,
    "remaining": 2,
    "percentage": 60
  }
}
```

## 🔄 **Subscription Lifecycle Management**

### **Upgrade Flow**
1. User initiates upgrade via payment system
2. Stripe processes payment
3. Webhook updates user tier to `PREMIUM`
4. JWT token automatically reflects new tier on next request

### **Downgrade Flow**
1. Subscription expires or is cancelled
2. Webhook updates user tier to `FREE`
3. User retains access to existing data
4. New feature usage is limited to free tier

## 🛡️ **Security Considerations**

### **Double Verification**
- JWT token provides fast tier checking
- Database verification for critical features
- Webhook-based subscription status updates

### **Graceful Degradation**
- Users keep existing data when downgrading
- Clear messaging about feature limitations
- Upgrade prompts at appropriate moments

## 📱 **Frontend Integration**

### **Tier Information Hook**
```typescript
// React hook for tier information
const useTierInfo = () => {
  const { data: tierInfo } = useQuery({
    queryKey: ['tier-info'],
    queryFn: () => apiClient.get('/premium/tier-info')
  });
  
  return tierInfo;
};
```

### **Feature Gating Component**
```typescript
// React component for feature gating
const PremiumFeature = ({ children, featureName }) => {
  const { data: tierInfo } = useTierInfo();
  
  if (!tierInfo?.isPremium) {
    return <UpgradePrompt featureName={featureName} />;
  }
  
  return children;
};
```

## 🚀 **Next Steps**

### **Immediate Actions**
1. **Deploy Premium Middleware** - Add to existing routes
2. **Implement Usage Tracking** - Add to AI and storage features
3. **Create Upgrade Flows** - Integrate with payment system
4. **Add Premium UI Components** - Frontend tier management

### **Feature Rollout Plan**
1. **Week 1**: Trip creation limits
2. **Week 2**: AI request limits
3. **Week 3**: Storage limits
4. **Week 4**: Premium-only features

### **Monitoring & Analytics**
- Track conversion rates from free to premium
- Monitor usage patterns across tiers
- A/B test feature limitations
- Analyze user feedback and pain points

## 📋 **API Endpoints Reference**

### **Premium Management**
- `GET /api/premium/tier-info` - Get user tier information
- `GET /api/premium/feature-comparison` - Compare tiers
- `GET /api/premium/subscription` - Get subscription details
- `GET /api/premium/usage/:feature` - Get usage statistics

### **Payment Integration**
- `POST /api/payments/create-subscription` - Create subscription
- `POST /api/payments/create-checkout-session` - Stripe checkout
- `GET /api/payments/subscription-status` - Check status

## 🎯 **Success Metrics**

### **Business Metrics**
- **Conversion Rate**: Free to premium conversion
- **Revenue**: Monthly recurring revenue (MRR)
- **Churn Rate**: Premium subscription retention
- **Feature Adoption**: Usage of premium features

### **Technical Metrics**
- **API Performance**: Response times with premium checks
- **Error Rates**: Failed premium verifications
- **Usage Patterns**: Feature usage distribution
- **System Load**: Impact of premium middleware

---

This implementation provides a robust, scalable foundation for premium features while maintaining excellent user experience and clear upgrade paths. 


<!-- ======================================================= GEMINI RESPONSE ===============================================================================-->
<!-- ======================================================================================================================================================= -->
<!-- ======================================================================================================================================================= -->


As a senior software and product engineer, I've evaluated your existing code for implementing premium gating. Below is a detailed analysis covering bugs, security vulnerabilities, and performance issues, along with their fixes. I've also provided a comprehensive guide on how to apply these premium gating mechanisms across your application's features.

### **Code Evaluation and Fixes**

Here's an assessment of the provided code with recommended improvements:

-----

### **1. `premium.middleware.ts`**

This file is the core of your feature gating, and while it's a good start, it has some potential issues.

#### **Bugs and Logical Flaws:**

  * **Inconsistent Premium User Check:** The `requirePremium` middleware checks `authReq.user.isProUser` from the JWT token but then might perform a database lookup. If the JWT is stale (the user has since been downgraded), the middleware might incorrectly grant access if `requireActiveSubscription` is `false`. The source of truth should consistently be the database for critical checks.
  * **Redundant Code in `checkSubscriptionLimits`:** The logic for free and premium users can be consolidated to reduce duplication and improve maintainability.
  * **Hardcoded Limits:** The `getPremiumLimit` function has hardcoded values that are also present in `getPremiumTierLimits`. This can lead to inconsistencies if one is updated and the other isn't.

#### **Security Vulnerabilities:**

  * **Stale JWT Data:** The `isProUser` flag in the JWT can become outdated. While you have a check against the database with `requireActiveSubscription`, this should be the default behavior for all premium features to prevent unauthorized access if a user's subscription expires or is canceled.

#### **Performance Issues:**

  * **Multiple Database Calls:** In `checkSubscriptionLimits`, you first check the user type and then make a database call to `getCurrentUsage`. This can be optimized by fetching user and subscription data together. The `addUsageHeaders` middleware also makes a separate call to `getCurrentUsage`, which could be redundant if `checkSubscriptionLimits` is used on the same route.

### **Refactored `premium.middleware.ts`:**

```typescript
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from './auth';
import ApiError from '../utils/ApiError';
import logger from '../utils/logger';
import { prisma } from '../services/prisma';
import { SubscriptionStatus, UserType } from '@prisma/client';
import { premiumService } from '../services/premium.service'; // Assuming you have a premium service

export interface PremiumFeatureConfig {
    featureName: string;
    customMessage?: string;
}

/**
 * Middleware to check if a user has an active premium subscription.
 * This should be the primary middleware for gating premium features.
 */
export const requirePremium = (config: PremiumFeatureConfig): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            return next(ApiError.Unauthorized('Authentication required'));
        }

        try {
            const subscription = await prisma.subscription.findFirst({
                where: {
                    userId: authReq.user.id,
                    status: SubscriptionStatus.ACTIVE
                }
            });

            if (!subscription) {
                logger.warn(`User ${authReq.user.id} attempted to access premium feature "${config.featureName}" without an active subscription.`);
                return next(ApiError.Forbidden(
                    config.customMessage || 'This is a premium feature. Please upgrade your plan to get access.'
                ));
            }

            // Attach subscription info to the request for downstream use
            (authReq as any).subscription = subscription;
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
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            return next(ApiError.Unauthorized('Authentication required'));
        }

        try {
            const { allowed, reason } = await premiumService.canPerformAction(authReq.user.id, limitType);

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
 * Middleware to add usage information to response headers.
 * This can be used for informational purposes on the frontend.
 */
export const addUsageHeaders = (limitType: UsageLimitType): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authReq = req as AuthRequest;

        if (authReq.user) {
            try {
                const tierInfo = await premiumService.getUserTierInfo(authReq.user.id);
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
```

-----

### **2. `premium.service.ts`**

This service class is well-structured, but we can make it more robust and performant.

#### **Bugs and Logical Flaws:**

  * **Inconsistent User Type:** The service uses `user.userType === UserType.PREMIUM` to determine if a user is premium. This should be cross-referenced with an active subscription for accuracy, as the `userType` might not be immediately downgraded upon subscription cancellation.
  * **Placeholder for AI Requests:** The `getAIRequestCount` is a placeholder. This needs a proper implementation.

#### **Performance Issues:**

  * **N+1 Query Problem:** The `getUserUsage` method issues multiple `count` queries to the database. While `Promise.all` runs them in parallel, this can be optimized into a single, more complex query if performance becomes an issue, especially with a large number of users. For now, it's acceptable.
  * **Redundant `getUserTierInfo` Call:** In `canPerformAction`, `getUserTierInfo` is called, which in turn calls `getUserUsage`. This is efficient within the service, but be mindful of how many times this is called per request.

### **Improved `premium.service.ts`:**

```typescript
// ... (imports)

class PremiumService {
    // ... (tierLimits definition)

    /**
     * Get comprehensive tier information for a user.
     * The source of truth for premium status is an active subscription.
     */
    async getUserTierInfo(userId: string): Promise<UserTierInfo> {
        try {
            const [user, subscription, usage] = await Promise.all([
                prisma.user.findUnique({ where: { id: userId, deleted: false }, select: { userType: true } }),
                this.getActiveSubscription(userId),
                this.getUserUsage(userId)
            ]);

            if (!user) {
                throw new Error('User not found');
            }

            const isPremium = !!subscription; // Primary source of truth
            const limits = isPremium ? this.tierLimits.premium : this.tierLimits.free;

            // ... (rest of the logic remains the same)

            return {
                isPremium,
                // ...
            };
        } catch (error) {
            // ...
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

    // ... (getUserUsage can be further optimized with raw queries or query batching if needed)

    /**
     * Track AI request usage.
     */
    async trackAIRequest(userId: string, requestType: string, count: number = 1): Promise<void> {
        try {
            // This should be an actual implementation.
            // For example, using a separate table or a caching layer like Redis.
            // For simplicity, we'll assume a table `AIRequestLog`.
            await prisma.aIRequestLog.create({
                data: {
                    userId,
                    requestType,
                    count
                }
            });
            logger.info(`AI request tracked for user ${userId}: ${requestType}`);
        } catch (error) {
            logger.error('Error tracking AI request:', error);
        }
    }

    // ... (other methods)
}

export const premiumService = new PremiumService();
```

-----

### **3. `premium.controller.ts`**

The controller has some inconsistencies in error handling and request property access.

#### **Bugs and Logical Flaws:**

  * **Inconsistent Error Handling:** Some methods use `next(ApiError...)` while others call `ApiError...` without `next()`. The `asyncWrapper` utility should handle this, but it's not consistently applied.
  * **Unsafe `req.user` Access:** `getUserTierInfo` directly accesses `req.user?.id` without ensuring the user is authenticated first. While the route might have middleware, the controller method itself should be robust.
  * **Redundant Database Calls:** `getUsageStats` calls both `getUserUsage` and `getUserTierInfo`, which is redundant as the latter already includes usage stats.

### **Revised `premium.controller.ts`:**

```typescript
// ... (imports)

class PremiumController {
    /**
     * Get user's current tier information and usage
     */
    getUserTierInfo = asyncWrapper(async (req: Request, res: Response) => {
        const userId = (req as AuthRequest).user.id;
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
     * Get usage statistics for a specific feature
     */
    getUsageStats = asyncWrapper(async (req: Request, res: Response, next: NextFunction) => {
        const userId = (req as AuthRequest).user.id;
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

    // ... (other methods refactored similarly with asyncWrapper and proper error handling)
}

export const premiumController = new PremiumController();
```

-----

### **Guide to Implementing Premium Gating**

Now, let's discuss how to apply these gating mechanisms to your features.

#### **Step 1: Define Your Premium Features**

First, clearly categorize your features. Based on your routes, here's a possible breakdown:

  * **Completely Premium Features:** These are features that free users cannot access at all.
      * `trip-templates`: Creating and using custom trip templates.
      * Advanced AI-powered features within `/recommendations`.
      * Advanced analytics or export options.
  * **Usage-Limited Features:** Free users have limited access, while premium users have higher or unlimited access.
      * `/trips`: Number of trips a user can create.
      * `/photos`: Amount of photo storage.
      * `/journal-entries`: Number of journal entries.
      * `/itineraries`: Adding collaborators to an itinerary.
  * **Mixed Features:** Some parts of a feature are free, while others are premium.
      * `/expenses`: Basic expense tracking is free, but detailed analytics and categorization might be premium.
      * `/badges`: All users can earn badges, but some rare or special badges might only be available to premium users.

#### **Step 2: Apply Middleware to Your Routes**

Now, you'll use the refactored middleware to protect your routes. You would typically do this in your `tripRouter.ts`, `photoRouter.ts`, etc.

**Example for `/trip-templates` (Completely Premium):**

In `tripTemplateRouter.ts`:

```typescript
import { Router } from 'express';
import { requirePremium } from '../middlewares/premium.middleware';
import { tripTemplateController } from '../controllers/tripTemplate.controller';

const router = Router();

// Protect all routes in this file with the requirePremium middleware
router.use(requirePremium({ featureName: 'Trip Templates' }));

router.post('/', tripTemplateController.createTemplate);
router.get('/', tripTemplateController.getTemplates);
// ... other routes

export default router;
```

**Example for `/trips` (Usage-Limited):**

In `tripRouter.ts`, you would apply the `checkSubscriptionLimits` middleware specifically to the route that creates a new trip.

```typescript
import { Router } from 'express';
import { checkSubscriptionLimits } from '../middlewares/premium.middleware';
import { tripController } from '../controllers/trip.controller';

const router = Router();

// This route creates a new trip, so we check the limit before proceeding.
router.post('/', checkSubscriptionLimits('trips'), tripController.createTrip);

// Other routes like getting a trip by ID might not need this check.
router.get('/:id', tripController.getTrip);

// ... other routes

export default router;
```

#### **Step 3: In-Controller/Service Checks for Granular Control**

For more complex logic, you might need to perform checks within your controllers or services.

**Example for a "Smart Add" feature in `/itineraries`:**

Let's say you have an AI-powered feature to add items to an itinerary. This could be a premium feature.

In your `itineraryController.ts`:

```typescript
import { premiumService } from '../services/premium.service';
import ApiError from '../utils/ApiError';

// ...

// Inside a method like `addSmartItineraryItem`
public async addSmartItineraryItem(req: Request, res: Response, next: NextFunction) {
    const userId = (req as AuthRequest).user.id;

    // Check for an active subscription
    const isPremium = await premiumService.hasActiveSubscription(userId);
    if (!isPremium) {
        return next(ApiError.Forbidden('AI-powered itinerary suggestions are a premium feature.'));
    }

    // Also, check their AI request usage
    const { allowed, reason } = await premiumService.canPerformAction(userId, 'ai_requests');
    if (!allowed) {
        return next(ApiError.Forbidden(reason));
    }

    // If all checks pass, proceed with the feature logic...
    // And don't forget to track the usage.
    await premiumService.trackAIRequest(userId, 'smart_itinerary_item');

    // ...
}
```

#### **Step 4: Frontend Integration**

Your frontend needs to be aware of the user's tier and usage to provide a good user experience.

  * **Displaying Premium Features:** Use the `/api/premium/tier-info` endpoint when the user logs in to determine their status. Show or hide UI elements accordingly. For example, a "Create Trip Template" button might be disabled with a tooltip for free users.
  * **Usage Meters:** Use the data from `tier-info` or the `X-Usage-*` headers to display progress bars or counters for limited features (e.g., "You have used 3 of 5 free trips").
  * **Upgrade Prompts:** When a user tries to access a premium feature or hits a usage limit, the API will return a `403 Forbidden` error. Your frontend should catch this and display a modal or a page encouraging the user to upgrade. The error message from the API can be displayed directly.

By following this structured approach, you can effectively and securely implement premium gating across your application, creating a clear distinction between your free and premium offerings.

Of course. Yes, you should absolutely add an `AIRequestLog` model to your schema. It's the most robust and scalable way to track AI-related usage. Relying on placeholders or in-memory counting is not suitable for a production system.

Here’s the new model, how it integrates into your system, and how it will be populated.

### **New `AIRequestLog` Model**

Add the following model to your `schema.prisma` file. A good place for it is after the `User` model or with other logging/tracking models.

```prisma
model AIRequestLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  requestType String   // e.g., 'itinerary_suggestion', 'description_generation', 'smart_budget'
  count       Int      @default(1)
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([userId, createdAt])
  @@index([requestType])
}
```

After adding this to your schema, run the following commands to update your database and Prisma Client:

```bash
npx prisma migrate dev --name add_ai_request_log
npx prisma generate
```

-----

### **How It Integrates and Gets Populated**

The `AIRequestLog` table is not meant to be a standalone feature with its own API routes for creation. Instead, it serves as an internal accounting system. It will be populated exclusively by your backend services whenever a user performs an action that consumes an "AI request."

Here’s the workflow:

1.  **User Action**: A user performs an action in the UI that triggers an AI-powered feature, like clicking "Generate AI Itinerary" or "Suggest a Trip Description."
2.  **API Call**: The frontend sends a request to the relevant API endpoint (e.g., `POST /api/itineraries/ai-suggest`).
3.  **Permission Check (Gating)**: Inside the controller or service for that endpoint, you first check if the user is *allowed* to perform the action using the `premiumService.canPerformAction(userId, 'ai_requests')` method. This method will query the `AIRequestLog` table to get the current usage.
4.  **Action and Logging (Population)**: If the user is allowed, your system performs the AI-related task. **Immediately after the task is successfully completed**, you call the `premiumService.trackAIRequest()` method. This method is responsible for creating a new entry in the `AIRequestLog` table.

This ensures that usage is only logged when an action is successfully performed.

#### **Updated `premium.service.ts` Implementation**

Here's how you would update your `premium.service.ts` to use the new model, removing the placeholders.

```typescript
// premium.service.ts

// ... other imports
import { prisma } from '../../services/prisma';
import logger from '../../utils/logger';
// ...

class PremiumService {
  // ...

  /**
   * Get current usage statistics for a user.
   */
  async getUserUsage(userId: string): Promise<UsageStats> {
    try {
      const [
        trips,
        collaborators,
        journalEntries,
        photos,
        aiRequests, // This will now be a real value
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
      throw error;
    }
  }

  /**
   * Track AI request usage by creating a log entry.
   * This is called AFTER a successful, gated AI action.
   */
  async trackAIRequest(userId: string, requestType: string): Promise<void> {
    try {
      await prisma.aIRequestLog.create({
        data: {
          userId,
          requestType,
          // count is defaulted to 1 in the schema
        },
      });
      logger.info(`AI request tracked for user ${userId}: ${requestType}`);
    } catch (error) {
      logger.error('Error tracking AI request:', error);
      // Decide if you want to throw the error or just log it
    }
  }

  /**
   * Get AI request count for a user within the current billing period.
   * (This is a simplified version that counts all requests. A real implementation
   * might only count requests from the last 30 days or since the last subscription renewal).
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

  // ... rest of the service
}

export const premiumService = new PremiumService();
```

By adding the `AIRequestLog` model, you create a persistent, auditable record of usage that directly and accurately feeds into your premium gating system.

<!-- =======================================================CLUADE============================================================================== -->
// config/premium-features.ts
export const PREMIUM_FEATURES = {
  TRIPS: {
    featureName: 'trip_creation',
    requireActiveSubscription: true,
    customMessage: 'Create unlimited trips with Premium. Upgrade now!'
  },
  AI_RECOMMENDATIONS: {
    featureName: 'ai_recommendations',
    requireActiveSubscription: true,
    customMessage: 'Get AI-powered recommendations with Premium!'
  },
  ADVANCED_ANALYTICS: {
    featureName: 'advanced_analytics',
    requireActiveSubscription: true,
    customMessage: 'View detailed analytics with Premium!'
  },
  COLLABORATIVE_EDITING: {
    featureName: 'collaborative_editing',
    requireActiveSubscription: false, // Allow for premium users without active subscription
    customMessage: 'Real-time collaboration requires Premium!'
  },
  EXPORT_FEATURES: {
    featureName: 'export_features',
    requireActiveSubscription: true,
    customMessage: 'Export your data with Premium!'
  }
} as const;

import { requirePremium, checkSubscriptionLimits } from '../middlewares/premium.middleware';
import { PREMIUM_FEATURES } from '../config/premium-features';

const router = Router();

// Apply authentication
router.use(authMiddleware);

// Free tier: 3 trips, Premium: 100 trips
router.post('/', 
  checkSubscriptionLimits('trips', 3),
  tripController.createTrip
);

// Premium feature: AI-powered trip recommendations
router.post('/ai-recommendations', 
  requirePremium(PREMIUM_FEATURES.AI_RECOMMENDATIONS),
  tripController.getAIRecommendations
);

// Premium feature: Advanced analytics
router.get('/:id/analytics', 
  requirePremium(PREMIUM_FEATURES.ADVANCED_ANALYTICS),
  tripController.getAdvancedAnalytics
);

// Premium feature: Export trip data
router.get('/:id/export', 
  requirePremium(PREMIUM_FEATURES.EXPORT_FEATURES),
  tripController.exportTrip
);