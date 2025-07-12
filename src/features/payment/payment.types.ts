import { PaymentStatus, SubscriptionStatus } from '@prisma/client';

export interface CreatePaymentIntentData {
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, string | number | null>;
  idempotencyKey?: string;
}

export interface CreateSubscriptionData {
  userId: string;
  planId: string;
  paymentMethodId: string; // For API-based subscriptions, not checkout
  metadata?: Record<string, string | number | null>;
}

export interface CreateCheckoutSessionData {
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string | number | null>;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
  status: string; // This comes directly from Stripe's PaymentIntent status
  amount: number;
  currency: string;
}

export interface SubscriptionResult {
  id: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  stripeSubscriptionId: string;
}

export interface CheckoutSessionResult {
  id: string;
  url: string;
  status: string; // This comes directly from Stripe's Checkout Session status
}

export interface WebhookEventData {
  id: string;
  type: string;
  data: any;
}

// ----Payment Service -----

export interface CreatePaymentRequest {
  userId: string;
  amount: number;
  currency: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface CreateSubscriptionRequest {
  userId: string;
  planId: string;
  paymentMethodId: string;
  metadata?: Record<string, any>;
}

export interface CreateCheckoutSessionRequest {
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  id: string;
  clientSecret: string;
  status: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface SubscriptionResponse {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    interval: string;
  };
}

export interface CheckoutSessionResponse {
  id: string;
  url: string;
  status: string;
}

export interface PaymentHistoryResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  description?: string;
  createdAt: Date;
  subscription?: {
    id: string;
    plan: {
      name: string;
      price: number;
      currency: string;
    };
  };
}