import { Router } from 'express';
import { paymentController } from './payment.controller';
import { authMiddleware, userOrAdminOnly } from '../../middlewares/auth';
import { validateBody, validateQuery, validateParams } from '../../middlewares/validation.middleware';
import {
  createPaymentSchema,
  createCheckoutSessionSchema,
  cancelSubscriptionSchema,
  getPaymentSchema,
  getPaymentHistorySchema,
  webhookSchema
} from './payment.validation';
import { paymentRateLimiter, webhookRateLimiter } from '../../middlewares/rateLimit';
import { handleStripeWebhook } from './payment.middleware'
 
const router = Router();

// Public routes (no authentication required)
router.get('/plans', paymentController.getSubscriptionPlans);

// Webhook endpoint (no authentication, but signature verification)
router.post('/webhook', webhookRateLimiter, validateBody(webhookSchema.shape.headers), handleStripeWebhook);


// Protected routes (authentication required)
router.use(authMiddleware);

// Payment routes
router.post(
  '/create-payment',
  paymentRateLimiter,
  validateBody(createPaymentSchema),
  paymentController.createPayment
);


router.post(
  '/create-checkout-session',
  paymentRateLimiter,
  validateBody(createCheckoutSessionSchema.shape.body),
  paymentController.createCheckoutSession
);

router.delete(
  '/subscriptions/:subscriptionId',
  validateParams(cancelSubscriptionSchema.shape.params),
  validateBody(cancelSubscriptionSchema.shape.body),
  paymentController.cancelSubscription
);

router.get(
  '/payments/:paymentId',
  validateParams(getPaymentSchema.shape.params),
  paymentController.getPayment
);

router.get(
  '/subscriptions/active',
  paymentController.getUserActiveSubscription
);

router.get(
  '/payments/history',
  validateQuery(getPaymentHistorySchema.shape.query),
  paymentController.getUserPaymentHistory
);

router.get(
  '/payments/stats',
  paymentController.getUserPaymentStats
);

export default router; 