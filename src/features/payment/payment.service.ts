import { prisma } from '../../services/prisma';
import { stripeService } from './stripe.service';
import { emailService } from '../../services/email/email.service';
import ApiError from '../../utils/ApiError';
import logger from '../../utils/logger';
import { PaymentStatus, PaymentType, SubscriptionStatus } from '@prisma/client';
import {
  CreatePaymentRequest,
  CreateSubscriptionRequest,
  CreateCheckoutSessionRequest,
  PaymentResponse,
  SubscriptionResponse,
  CheckoutSessionResponse,
  PaymentHistoryResponse
} from './payment.types'



class PaymentService {
  /**
   * Create a one-time payment
   */
  async createPaymentIntent(userId: string, data: CreatePaymentRequest): Promise<PaymentResponse> {
    try {
      const result = await stripeService.createPaymentIntent(userId, data);
      logger.info(`Payment intent created for user ${data.userId}: ${result.id}`);

      return {
        id: result.id,
        clientSecret: result.clientSecret,
        status: result.status,
        amount: result.amount,
        currency: result.currency,
      };

    } catch (error) {
      logger.error('Failed to create payment:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.InternalServerError('Failed to create payment');
    }
  }

  /**
   * Create a Stripe Checkout Session for subscription
   */
  async createCheckoutSession(data: CreateCheckoutSessionRequest): Promise<CheckoutSessionResponse> {
    try {
      const result = await stripeService.createCheckoutSession(data);
      logger.info(`Checkout session created for user ${data.userId}: ${result.id}`);
      return result;

    } catch (error) {
      logger.error('Failed to create checkout session:', error);
      if (error instanceof ApiError) throw error;
      throw ApiError.InternalServerError('Failed to create checkout session');
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(userId: string, subscriptionId: string, cancelAtPeriodEnd: boolean): Promise<void> {
    try {
      // 1. Verify the subscription belongs to the requesting user.
      const subscription = await prisma.subscription.findFirst({
        where: { id: subscriptionId, userId },
      });

      if (!subscription) {
        throw ApiError.NotFound('Subscription not found or you do not have permission to cancel it.');
      }

      // 2. Delegate the cancellation to the stripeService.
      await stripeService.cancelSubscription(subscription.id, cancelAtPeriodEnd);
      logger.info(`Subscription cancellation requested for ${subscriptionId} by user ${userId}`);
    } catch (error) {
      logger.error('Failed to cancel subscription in PaymentService:', { error, userId, subscriptionId });
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string, userId: string) {
    const payment = await stripeService.getPayment(paymentId, userId);

    if (!payment) {
      throw ApiError.NotFound('Payment not found');
    }

    return {
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      type: payment.type,
      description: payment.description,
      createdAt: payment.createdAt,
      subscription: payment.subscription ? {
        id: payment.subscription.id,
        planName: payment.subscription.plan.name,
      } : undefined,
    };
  }


  /**
   * Get user's active subscription
   */
  async getUserActiveSubscription(userId: string) {
    const subscription = await stripeService.getUserActiveSubscription(userId);

    if (!subscription) {
      return null;
    }

    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      cancelledAt: subscription.cancelledAt,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        price: Number(subscription.plan.price),
        currency: subscription.plan.currency,
        interval: subscription.plan.interval,
        description: subscription.plan.description
      }
    };
  }

  /**
   * Get user's payment history
   */
  async getUserPaymentHistory(userId: string, limit: number = 10, offset: number = 0): Promise<PaymentHistoryResponse[]> {
        // Validate pagination parameters
    if (limit < 1 || limit > 100) {
      throw ApiError.BadRequest('Limit must be between 1 and 100');
    }

    if (offset < 0) {
      throw ApiError.BadRequest('Offset must be non-negative');
    }
    
    const payments = await stripeService.getUserPayments(userId, limit, offset);

    return payments.map(payment => ({
      id: payment.id,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      type: payment.type,
      description: payment.description,
      createdAt: payment.createdAt,
      subscription: payment.subscription ? {
        id: payment.subscription.id,
        plan: {
          name: payment.subscription.plan.name,
          price: Number(payment.subscription.plan.price),
          currency: payment.subscription.plan.currency
        }
      } : undefined
    }));
  }

  /**
   * Get available subscription plans
   */
  async getSubscriptionPlans() {
    const plans = await stripeService.getSubscriptionPlans();

    return plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: Number(plan.price),
      currency: plan.currency,
      interval: plan.interval,
      features: plan.features as any, // Cast if features JSON structure is known
      productName: plan.product.name,
    }));
  }

  /**
   * Get payment statistics for user
   */
 async getUserPaymentStats(userId: string) {
    const stats = await prisma.payment.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
      _sum: { amount: true },
    });

    let totalPayments = 0;
    let successfulPayments = 0;
    let totalAmount = 0;

    for (const group of stats) {
      const count = group._count.status;
      totalPayments += count;
      if (group.status === PaymentStatus.SUCCEEDED) {
        successfulPayments = count;
        totalAmount = Number(group._sum.amount || 0);
      }
    }

    return {
      totalPayments,
      successfulPayments,
      failedPayments: totalPayments - successfulPayments,
      totalAmount,
      successRate: totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 0,
    };
  }
}

export const paymentService = new PaymentService(); 