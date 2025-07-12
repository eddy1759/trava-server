import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { StatusCodes } from 'http-status-codes';
import { Decimal } from '@prisma/client/runtime/library';
import { 
  PaymentStatus, 
  PaymentType, 
  SubscriptionStatus, 
  User, 
  Plan, 
  WebhookEventStatus, 
  Prisma 
} from '@prisma/client';

import CONFIG from '../../config/env';
import logger from '../../utils/logger';
import { prisma } from '../../services/prisma';
import ApiError from '../../utils/ApiError';
import { 
  CreatePaymentIntentData, 
  CreateSubscriptionData, 
  CreateCheckoutSessionData, 
  PaymentIntentResult,
  SubscriptionResult, 
  CheckoutSessionResult, 
  WebhookEventData 
} from './payment.types'



class StripeService {
  private stripe: Stripe;
  private readonly webhookSecret: string;

  constructor() {
    const stripeSecretKey = CONFIG.STRIPE_SECRET_KEY;
    const webhookSecret = CONFIG.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey || !webhookSecret) {
      logger.error('Stripe secret key or webhook secret is not configured.');
      throw new Error('Stripe configuration is missing.');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
      telemetry: false,
    });
    this.webhookSecret = webhookSecret;
  }

  
  /**
   * Create a payment intent for one-time payments
   */
  async createPaymentIntent(userId: string, data: CreatePaymentIntentData): Promise<PaymentIntentResult> {
    const idempotencyKey = data.idempotencyKey || uuidv4();

    try {
      return await prisma.$transaction(async (tx) => {
        const existingPayment = await tx.payment.findUnique({
          where: { idempotencyKey },
        });

        if (existingPayment) {
          logger.warn(`Attempted to create a duplicate payment with idempotency key: ${idempotencyKey}`);
          // It's crucial not to return the client_secret for existing payments.
          // The frontend should handle this by knowing the payment was already created.
          throw ApiError.Conflict(`Payment with key ${idempotencyKey} already processed.`);
        }

        // 2. Get user and ensure they exist.
        const user = await tx.user.findUnique({
          where: { id: userId, deleted: false },
        });

        if (!user) {
          throw ApiError.NotFound('User not found');
        }

        // 3. Get or create a Stripe Customer.
        const customer = await this.getOrCreateCustomer(user, tx);

        // 4. Create the Payment Intent in Stripe.
        const paymentIntent = await this.stripe.paymentIntents.create(
          {
            amount: Math.round(data.amount * 100), // Amount in cents
            currency: data.currency.toLowerCase() || 'usd',
            customer: customer.id,
            description: data.description,
            metadata: {
              userId: userId,
              idempotencyKey,
              ...data.metadata,
            },
            automatic_payment_methods: {
              enabled: true,
            },
          },
          { idempotencyKey }
        );

        // 5. Store the payment record in our database.
        const payment = await tx.payment.create({
          data: {
            userId: userId,
            stripePaymentIntentId: paymentIntent.id,
            amount: new Decimal(data.amount),
            currency: data.currency,
            status: PaymentStatus.PENDING,
            type: PaymentType.ONE_TIME,
            description: data.description,
            metadata: data.metadata,
            idempotencyKey,
          },
        });

        logger.info(`Created payment intent ${paymentIntent.id} for user ${userId}`);

        return {
          id: payment.id,
          clientSecret: paymentIntent.client_secret!,
          status: paymentIntent.status,
          amount: data.amount,
          currency: data.currency,
        };
      });
    } catch (error) {
      logger.error('Failed to create payment intent:', { error, userId: userId });
      if (error instanceof ApiError) throw error;
      if (error instanceof Stripe.errors.StripeError) {
        throw new ApiError(error.message, error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR);
      }
      throw ApiError.InternalServerError('Failed to create payment intent');
    }
  }

  /**
   * Create a Stripe Checkout Session for subscription
   */
  async createCheckoutSession(data: CreateCheckoutSessionData): Promise<CheckoutSessionResult> {
    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Get user and plan, ensuring they are valid.
        const [user, plan] = await Promise.all([
          tx.user.findUnique({ where: { id: data.userId, deleted: false } }),
          tx.plan.findUnique({ where: { id: data.planId, isActive: true } }),
        ]);

        if (!user) throw ApiError.NotFound('User not found');
        if (!plan) throw ApiError.NotFound('Subscription plan not found or is not active');

        // 2. Check for an existing active subscription to prevent duplicates.
        const existingSubscription = await tx.subscription.findFirst({
          where: {
            userId: data.userId,
            status: { in: [SubscriptionStatus.ACTIVE] },
          },
        });

        if (existingSubscription) {
          throw ApiError.Conflict('User already has an active subscription.');
        }

        // 3. Get or create Stripe Customer.
        const customer = await this.getOrCreateCustomer(user, tx);

        // 4. Create the Stripe Checkout Session.
        const session = await this.stripe.checkout.sessions.create({
          customer: customer.id,
          payment_method_types: ['card'],
          line_items: [{ price: plan.stripePriceId, quantity: 1 }],
          mode: 'subscription',
          success_url: data.successUrl,
          cancel_url: data.cancelUrl,
          metadata: {
            userId: data.userId,
            planId: data.planId,
            ...data.metadata,
          },
          subscription_data: {
            metadata: {
              userId: data.userId,
              planId: data.planId,
            },
          },
        });

        logger.info(`Created checkout session ${session.id} for user ${data.userId}`);

        return {
          id: session.id,
          url: session.url!,
          status: session.status as string,
        };
      });
    } catch (error) {
      logger.error('Failed to create checkout session:', { error, userId: data.userId });
      if (error instanceof ApiError) throw error;
      if (error instanceof Stripe.errors.StripeError) {
        throw new ApiError(error.message, error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR);
      }
      throw ApiError.InternalServerError('Failed to create checkout session');
    }
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.findUnique({
          where: { id: subscriptionId },
        });

        if (!subscription) {
          throw ApiError.NotFound('Subscription not found');
        }

        if (subscription.status === SubscriptionStatus.CANCELLED) {
          throw ApiError.Conflict('Subscription is already cancelled');
        }

        let stripeSubscription: Stripe.Subscription;
        if (cancelAtPeriodEnd) {
          stripeSubscription = await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        } else {
          stripeSubscription = await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        }

        // The webhook `customer.subscription.updated/deleted` will handle the final state change.
        // However, we can optimistically update our DB here for a faster UI response.
        await tx.subscription.update({
          where: { id: subscriptionId },
          data: this.mapStripeSubscriptionToDbData(stripeSubscription),
        });

        logger.info(`Requested cancellation for subscription ${subscriptionId}. Mode: ${cancelAtPeriodEnd ? 'at period end' : 'immediate'}`);
      });
    } catch (error) {
      logger.error('Failed to cancel subscription:', { error, subscriptionId });
      if (error instanceof ApiError) throw error;
      if (error instanceof Stripe.errors.StripeError) {
        throw new ApiError(error.message, error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR);
      }
      throw ApiError.InternalServerError('Failed to cancel subscription');
    }
  }

  /**
   * Process webhook events
   */
  async processWebhook(signature: string, payload: Buffer, sourceIp?: string): Promise<void> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
    } catch (err: any) {
      logger.error('Webhook signature verification failed.', { error: err.message, ip: sourceIp });
      throw ApiError.BadRequest('Invalid webhook signature');
    }

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Check if we've already processed this event.
        const existingEvent = await tx.webhookEvent.findUnique({
          where: { stripeEventId: event.id },
        });

        if (existingEvent) {
          logger.warn(`Webhook event ${event.id} already exists. Skipping.`);
          return; // Success, already handled.
        }

        // 2. Store the webhook event to have a record of it.
        const webhookEvent = await tx.webhookEvent.create({
          data: {
            stripeEventId: event.id,
            eventType: event.type,
            payload: event.data.object as unknown as Prisma.JsonObject,
            status: WebhookEventStatus.PENDING,
            source: sourceIp,
          },
        });

        // 3. Handle the event.
        await this.handleWebhookEvent(event, tx);

        // 4. Mark the event as processed.
        await tx.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: WebhookEventStatus.PROCESSED,
            processedAt: new Date(),
          },
        });

        logger.info(`Successfully processed webhook event ${event.id} (${event.type})`);
      });
    } catch (error) {
      logger.error(`Failed to process webhook event ${event.id}:`, { error });
      // Update webhook status outside the failed transaction
      await prisma.webhookEvent.updateMany({
        where: { stripeEventId: event.id },
        data: {
          status: WebhookEventStatus.FAILED,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      // Re-throw to signal failure to Stripe for retries.
      throw ApiError.InternalServerError('Webhook processing failed');
    }
  }

  /**
   * Handle different webhook event types
   */
  private async handleWebhookEvent(event: Stripe.Event, tx: Prisma.TransactionClient): Promise<void> {
    const dataObject = event.data.object as any;

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(dataObject as Stripe.Checkout.Session, tx);
        break;
      
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(dataObject as Stripe.Invoice, tx);
        break;

      case 'invoice.payment_failed':
        // The subscription status is updated via customer.subscription.updated,
        // so we just log this for now.
        logger.info(`Invoice payment failed for invoice: ${dataObject.id}`);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(dataObject as Stripe.Subscription, tx);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(dataObject as Stripe.Subscription, tx);
        break;
      
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(dataObject as Stripe.PaymentIntent, tx);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(dataObject as Stripe.PaymentIntent, tx);
        break;

      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, tx: Prisma.TransactionClient) {
    const { userId, planId } = session.metadata!;
    const stripeSubscriptionId = session.subscription as string;

    if (!stripeSubscriptionId) {
        logger.warn(`Checkout session ${session.id} completed without a subscription ID.`);
        return;
    }
    
    // Retrieve the full subscription object to get all details
    const stripeSubscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId);

    // Create a new subscription record in our database
    await tx.subscription.create({
        data: {
            userId,
            planId,
            stripeSubscriptionId: stripeSubscription.id,
            ...this.mapStripeSubscriptionToDbData(stripeSubscription)
        }
    });

    logger.info(`Created new subscription via checkout for user ${userId}, subscription ${stripeSubscription.id}`);
  }

  private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, tx: Prisma.TransactionClient) {
    if (!invoice.subscription) return;

    const paymentIntentId = invoice.payment_intent as string;
    if (!paymentIntentId) return;

    // Find the associated subscription
    const subscription = await tx.subscription.findUnique({
      where: { stripeSubscriptionId: invoice.subscription as string },
    });

    if (!subscription) {
      logger.warn(`Subscription not found for invoice: ${invoice.id}`);
      return;
    }
    
    // Create a corresponding payment record for this successful invoice.
    await tx.payment.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        stripePaymentIntentId: paymentIntentId,
        amount: new Decimal(invoice.amount_paid / 100),
        currency: invoice.currency,
        status: PaymentStatus.SUCCEEDED,
        type: PaymentType.SUBSCRIPTION,
        description: `Subscription renewal for plan: ${subscription.planId}`,
      }
    });

    // The subscription status itself is handled by `customer.subscription.updated`
    logger.info(`Recorded successful payment for invoice ${invoice.id}`);
  }

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription, tx: Prisma.TransactionClient) {
    const subscription = await tx.subscription.update({
      where: { stripeSubscriptionId: stripeSubscription.id },
      data: this.mapStripeSubscriptionToDbData(stripeSubscription),
    });

    // Grant or maintain premium access if subscription is active/trialing
    if (['ACTIVE', 'TRIALING'].includes(subscription.status)) {
        await tx.user.update({
            where: { id: subscription.userId },
            data: { userType: 'PREMIUM' }
        });
    }

    logger.info(`Subscription updated: ${stripeSubscription.id}, status: ${subscription.status}`);
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription, tx: Prisma.TransactionClient) {
    const subscription = await tx.subscription.update({
      where: { stripeSubscriptionId: stripeSubscription.id },
      data: {
        status: SubscriptionStatus.CANCELLED,
        cancelledAt: new Date(),
        endedAt: stripeSubscription.ended_at ? new Date(stripeSubscription.ended_at * 1000) : new Date(),
      },
    });

    // Downgrade user to free tier.
    await tx.user.update({
      where: { id: subscription.userId },
      data: { userType: 'FREE' },
    });

    logger.info(`Subscription deleted: ${stripeSubscription.id}. User ${subscription.userId} downgraded.`);
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, tx: Prisma.TransactionClient) {
    await tx.payment.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: { status: PaymentStatus.SUCCEEDED }
    });
    logger.info(`Payment succeeded: ${paymentIntent.id}`);
  }
  
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent, tx: Prisma.TransactionClient) {
    await tx.payment.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: { status: PaymentStatus.FAILED }
    });
    logger.info(`Payment failed: ${paymentIntent.id}`);
  }

  // --- Helper Methods ---

  /**
   * Get or create Stripe customer
   */
  private async getOrCreateCustomer(user: User, tx: Prisma.TransactionClient): Promise<Stripe.Customer> {
    if (user.stripeCustomerId) {
      try {
        const customer = await this.stripe.customers.retrieve(user.stripeCustomerId);
        // Check if the customer was deleted in Stripe
        if (customer.deleted) {
            logger.warn(`Stripe customer ${user.stripeCustomerId} was deleted. Creating a new one.`);
            return this.createNewCustomer(user, tx);
        }
        return customer as Stripe.Customer;
      } catch (error) {
        logger.error(`Failed to retrieve Stripe customer ${user.stripeCustomerId}. Creating a new one.`, { error });
        // The customer might not exist in Stripe anymore, so create a new one.
        return this.createNewCustomer(user, tx);
      }
    }
    return this.createNewCustomer(user, tx);
  }

  private async createNewCustomer(user: User, tx: Prisma.TransactionClient): Promise<Stripe.Customer> {
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.fullName || undefined,
      metadata: { userId: user.id },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customer.id },
    });

    logger.info(`Created new Stripe customer ${customer.id} for user ${user.id}`);
    return customer;
  }

  /**
   * Maps a Stripe subscription object to the data structure for our database.
   */
  private mapStripeSubscriptionToDbData(stripeSub: Stripe.Subscription): Omit<Prisma.SubscriptionCreateWithoutUserInput, 'plan' | 'stripeSubscriptionId'> {
    return {
      status: this.mapStripeSubscriptionStatus(stripeSub.status),
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      cancelledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
      endedAt: stripeSub.ended_at ? new Date(stripeSub.ended_at * 1000) : null,
    };
  }

  /**
   * Map Stripe subscription status to our enum
   */
  private mapStripeSubscriptionStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'canceled':
        return SubscriptionStatus.CANCELLED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      case 'incomplete_expired':
        return SubscriptionStatus.INCOMPLETE_EXPIRED;
      case 'incomplete':
        return SubscriptionStatus.INCOMPLETE;
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }

  // --- Data Fetching Methods ---

  async getPayment(paymentId: string, userId: string) {
    return prisma.payment.findUnique({
      where: { id: paymentId, userId },
      include: { user: { select: { id: true, email: true, fullName: true } }, subscription: { include: { plan: true } } },
    });
  }

  async getUserActiveSubscription(userId: string) {
    return prisma.subscription.findFirst({
      where: { userId, status: { in: [SubscriptionStatus.ACTIVE] } },
      include: { plan: true },
    });
  }

  async getUserPayments(userId: string, limit: number = 10, offset: number = 0) {
    return prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: { subscription: { include: { plan: true } } },
    });
  }

  async getSubscriptionPlans() {
    return prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
      include: { product: true }
    });
  }
}

export const stripeService = new StripeService(); 