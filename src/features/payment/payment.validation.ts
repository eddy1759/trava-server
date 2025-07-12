import { z } from 'zod';

// Create payment validation schema
export const createPaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(3).max(3).toUpperCase(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional()
})


// Create subscription validation schema
export const createSubscriptionSchema = z.object({
  body: z.object({
    planId: z.string().uuid('Invalid plan ID'),
    paymentMethodId: z.string().min(1, 'Payment method ID is required'),
    trialDays: z.number().int().min(0).max(30).optional(),
    metadata: z.record(z.any()).optional()
  })
});

// Create checkout session validation schema
export const createCheckoutSessionSchema = z.object({
  body: z.object({
    planId: z.string().uuid('Invalid plan ID'),
    successUrl: z.string().url('Invalid success URL'),
    cancelUrl: z.string().url('Invalid cancel URL'),
    trialDays: z.number().int().min(0).max(30).optional(),
    metadata: z.record(z.any()).optional()
  })
});

// Cancel subscription validation schema
export const cancelSubscriptionSchema = z.object({
  params: z.object({
    subscriptionId: z.string().uuid('Invalid subscription ID')
  }),
  body: z.object({
    cancelAtPeriodEnd: z.boolean().default(true)
  })
});

// Get payment validation schema
export const getPaymentSchema = z.object({
  params: z.object({
    paymentId: z.string().uuid('Invalid payment ID')
  })
});

// Get payment history validation schema
export const getPaymentHistorySchema = z.object({
  query: z.object({
    limit: z.string().optional().transform(val => parseInt(val || '10')),
    offset: z.string().optional().transform(val => parseInt(val || '0'))
  })
});

// Confirm payment success validation schema
export const confirmPaymentSuccessSchema = z.object({
  params: z.object({
    paymentId: z.string().uuid('Invalid payment ID')
  })
});

// Confirm payment failure validation schema
export const confirmPaymentFailureSchema = z.object({
  params: z.object({
    paymentId: z.string().uuid('Invalid payment ID')
  }),
  body: z.object({
    failureReason: z.string().optional()
  })
});

// Webhook validation schema
export const webhookSchema = z.object({
  headers: z.object({
    'stripe-signature': z.string().min(1, 'Stripe signature is required')
  })
});

// Type exports for TypeScript
export type CreatePaymentRequest = z.infer<typeof createPaymentSchema>;
export type CreateSubscriptionRequest = z.infer<typeof createSubscriptionSchema>['body'];
export type CancelSubscriptionRequest = z.infer<typeof cancelSubscriptionSchema>['body'];
export type GetPaymentHistoryRequest = z.infer<typeof getPaymentHistorySchema>['query'];
export type ConfirmPaymentFailureRequest = z.infer<typeof confirmPaymentFailureSchema>['body']; 