# Trava Payment System Documentation

## Overview

The Trava payment system is a robust, secure, and efficient Stripe integration that handles both one-time payments and subscription management. It follows the existing architecture patterns and includes comprehensive security measures, idempotency, and error handling.

## Architecture

### Core Components

1. **Database Models** (`prisma/schema.prisma`)
   - `SubscriptionPlan` - Available subscription plans
   - `Subscription` - User subscriptions
   - `Payment` - Payment records with idempotency
   - `WebhookEvent` - Stripe webhook event tracking

2. **Stripe Service** (`src/services/stripe.service.ts`)
   - Payment intent creation
   - Subscription management
   - Webhook processing
   - Customer management
   - Idempotency handling

3. **Payment Service** (`src/features/payment/payment.service.ts`)
   - Business logic layer
   - Email notifications
   - Payment statistics
   - User subscription management

4. **Payment Controller** (`src/features/payment/payment.controller.ts`)
   - HTTP request handling
   - Response formatting
   - Error handling

5. **Validation & Middleware**
   - Request validation with Zod
   - Rate limiting
   - Security middleware

## Security Features

### 1. Idempotency
- All payment operations use unique idempotency keys
- Prevents duplicate payments
- Database-level uniqueness constraints

### 2. Rate Limiting
- Payment endpoints: 10 requests per 15 minutes per user
- Webhook endpoints: 100 requests per minute per IP
- Configurable limits and windows

### 3. Input Validation
- Amount validation (minimum $0.50, maximum $10,000)
- Currency validation (USD, EUR, GBP, CAD, AUD)
- UUID validation for IDs
- Stripe signature verification

### 4. Error Handling
- Comprehensive error logging
- Graceful failure handling
- User-friendly error messages
- No sensitive data exposure

## Database Schema

### SubscriptionPlan
```sql
model SubscriptionPlan {
  id              String   @id @default(uuid())
  name            String   @unique
  description     String?
  price           Decimal
  currency        String   @default("USD")
  interval        String   // monthly, yearly
  stripePriceId   String   @unique
  features        Json     // Store features as JSON
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### Subscription
```sql
model Subscription {
  id                    String            @id @default(uuid())
  userId                String
  user                  User              @relation("UserSubscriptions", fields: [userId], references: [id])
  planId                String
  plan                  SubscriptionPlan  @relation(fields: [planId], references: [id])
  stripeSubscriptionId   String            @unique
  stripeCustomerId      String
  status                SubscriptionStatus
  currentPeriodStart    DateTime
  currentPeriodEnd      DateTime
  cancelAtPeriodEnd     Boolean           @default(false)
  cancelledAt           DateTime?
  trialStart            DateTime?
  trialEnd              DateTime?
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
}
```

### Payment
```sql
model Payment {
  id                    String        @id @default(uuid())
  userId                String
  user                  User          @relation("UserPayments", fields: [userId], references: [id])
  subscriptionId        String?
  subscription          Subscription? @relation(fields: [subscriptionId], references: [id])
  stripePaymentIntentId String        @unique
  stripeCustomerId      String
  amount                Decimal
  currency              String        @default("USD")
  status                PaymentStatus
  type                  PaymentType
  description           String?
  metadata              Json?
  idempotencyKey        String        @unique
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
}
```

## API Endpoints

### Public Endpoints

#### GET /api/v1/payments/plans
Get available subscription plans.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Premium Monthly",
      "description": "Premium features for monthly billing",
      "price": 9.99,
      "currency": "USD",
      "interval": "monthly",
      "features": {
        "unlimitedTrips": true,
        "aiRecommendations": true,
        "prioritySupport": true
      }
    }
  ]
}
```

### Protected Endpoints (Authentication Required)

#### POST /api/v1/payments/create-payment
Create a one-time payment.

**Request:**
```json
{
  "amount": 9.99,
  "currency": "USD",
  "description": "Premium upgrade",
  "metadata": {
    "feature": "premium_upgrade"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "payment_uuid",
    "clientSecret": "pi_xxx_secret_xxx",
    "status": "requires_payment_method",
    "amount": 9.99,
    "currency": "USD",
    "description": "Premium upgrade"
  }
}
```

#### POST /api/v1/payments/create-checkout-session
Create a Stripe Checkout Session for subscription.

**Request:**
```json
{
  "planId": "plan_uuid",
  "successUrl": "https://your-app.com/success",
  "cancelUrl": "https://your-app.com/cancel",
  "trialDays": 7,
  "metadata": {
    "source": "web"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "cs_xxx",
    "url": "https://checkout.stripe.com/pay/cs_xxx",
    "status": "open"
  }
}
```

**Frontend Integration:**
```javascript
// 1. Create checkout session
const response = await fetch('/api/v1/payments/create-checkout-session', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    planId: 'plan_uuid',
    successUrl: 'https://your-app.com/success',
    cancelUrl: 'https://your-app.com/cancel',
    trialDays: 7
  })
});

const { data } = await response.json();

// 2. Redirect user to Stripe Checkout
window.location.href = data.url;
```

#### POST /api/v1/payments/create-subscription
Create a subscription.

**Request:**
```json
{
  "planId": "plan_uuid",
  "paymentMethodId": "pm_xxx",
  "trialDays": 7,
  "metadata": {
    "source": "web"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "subscription_uuid",
    "status": "trialing",
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "plan": {
      "id": "plan_uuid",
      "name": "Premium Monthly",
      "price": 9.99,
      "currency": "USD",
      "interval": "monthly"
    }
  }
}
```

#### DELETE /api/v1/payments/subscriptions/:subscriptionId
Cancel a subscription.

**Request:**
```json
{
  "cancelAtPeriodEnd": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Subscription cancelled successfully"
}
```

#### GET /api/v1/payments/payments/:paymentId
Get payment details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "payment_uuid",
    "amount": 9.99,
    "currency": "USD",
    "status": "succeeded",
    "type": "ONE_TIME",
    "description": "Premium upgrade",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "subscription": {
      "id": "subscription_uuid",
      "plan": {
        "name": "Premium Monthly",
        "price": 9.99,
        "currency": "USD"
      }
    }
  }
}
```

#### GET /api/v1/payments/subscriptions/active
Get user's active subscription.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "subscription_uuid",
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "trialStart": "2024-01-01T00:00:00.000Z",
    "trialEnd": "2024-01-08T00:00:00.000Z",
    "plan": {
      "id": "plan_uuid",
      "name": "Premium Monthly",
      "price": 9.99,
      "currency": "USD",
      "interval": "monthly",
      "description": "Premium features"
    }
  }
}
```

#### GET /api/v1/payments/payments/history
Get user's payment history.

**Query Parameters:**
- `limit` (optional): Number of payments to return (default: 10, max: 100)
- `offset` (optional): Number of payments to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "payment_uuid",
      "amount": 9.99,
      "currency": "USD",
      "status": "succeeded",
      "type": "SUBSCRIPTION",
      "description": "Premium subscription",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "subscription": {
        "id": "subscription_uuid",
        "plan": {
          "name": "Premium Monthly",
          "price": 9.99,
          "currency": "USD"
        }
      }
    }
  ]
}
```

#### GET /api/v1/payments/payments/stats
Get user's payment statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPayments": 5,
    "successfulPayments": 4,
    "failedPayments": 1,
    "totalAmount": 39.96,
    "successRate": 80
  }
}
```

### Webhook Endpoint

#### POST /api/v1/payments/webhook
Stripe webhook endpoint for processing payment events.

**Headers:**
```
stripe-signature: whsec_xxx
```

**Body:** Raw Stripe webhook payload

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### 2. Database Migration

Run the database migration to create payment tables:

```bash
pnpm prisma migrate dev --name add_payment_models
```

### 3. Stripe Setup

1. Create a Stripe account and get your API keys
2. Create subscription products and prices in Stripe Dashboard
3. Set up webhook endpoint in Stripe Dashboard:
   - URL: `https://your-domain.com/api/v1/payments/webhook`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`

### 4. Seed Subscription Plans

Create subscription plans in your database:

```sql
INSERT INTO "SubscriptionPlan" (
  id, name, description, price, currency, interval, 
  "stripePriceId", features, "isActive", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), 'Premium Monthly', 'Premium features for monthly billing', 
  9.99, 'USD', 'monthly', 'price_xxx', 
  '{"unlimitedTrips": true, "aiRecommendations": true, "prioritySupport": true}', 
  true, NOW(), NOW()
);
```

## Frontend Integration

### 1. Install Stripe.js

```html
<script src="https://js.stripe.com/v3/"></script>
```

### 2. Initialize Stripe

```javascript
const stripe = Stripe('pk_test_xxx');
```

### 3. Create Payment Intent

```javascript
// 1. Create payment intent on your server
const response = await fetch('/api/v1/payments/create-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    amount: 9.99,
    currency: 'USD',
    description: 'Premium upgrade'
  })
});

const { data } = await response.json();

// 2. Confirm payment with Stripe
const result = await stripe.confirmCardPayment(data.clientSecret, {
  payment_method: {
    card: elements.getElement('card'),
    billing_details: {
      name: 'John Doe',
      email: 'john@example.com'
    }
  }
});

if (result.error) {
  console.error('Payment failed:', result.error);
} else {
  console.log('Payment succeeded:', result.paymentIntent);
}
```

### 4. Create Subscription

```javascript
// 1. Create payment method
const { paymentMethod } = await stripe.createPaymentMethod({
  type: 'card',
  card: elements.getElement('card'),
  billing_details: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});

// 2. Create subscription on your server
const response = await fetch('/api/v1/payments/create-subscription', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    planId: 'plan_uuid',
    paymentMethodId: paymentMethod.id,
    trialDays: 7
  })
});

const { data } = await response.json();
console.log('Subscription created:', data);
```

## Security Best Practices

### 1. Webhook Security
- Always verify Stripe webhook signatures
- Use HTTPS for webhook endpoints
- Implement idempotency to prevent duplicate processing

### 2. Payment Security
- Never store payment method details
- Use Stripe's secure payment methods
- Implement proper error handling
- Log security events

### 3. Rate Limiting
- Limit payment attempts per user
- Implement progressive delays for failed attempts
- Monitor for suspicious activity

### 4. Data Protection
- Encrypt sensitive data at rest
- Use secure connections (HTTPS)
- Implement proper access controls
- Regular security audits

## Error Handling

### Common Error Responses

```json
{
  "success": false,
  "error": "Payment amount must be at least $0.50"
}
```

```json
{
  "success": false,
  "error": "Invalid currency. Supported currencies: USD, EUR, GBP, CAD, AUD"
}
```

```json
{
  "success": false,
  "error": "User already has an active subscription"
}
```

```json
{
  "success": false,
  "error": "Too many payment requests, please try again later.",
  "retryAfter": 900
}
```

## Monitoring and Logging

### Key Metrics to Monitor
- Payment success/failure rates
- Webhook processing times
- Subscription conversion rates
- Revenue metrics
- Error rates by endpoint

### Logging
- All payment attempts are logged
- Webhook events are tracked
- Security events are logged
- Performance metrics are recorded

## Testing

### Unit Tests
- Payment service methods
- Stripe service integration
- Validation logic
- Error handling

### Integration Tests
- End-to-end payment flow
- Webhook processing
- Subscription lifecycle
- Error scenarios

### Load Tests
- Payment endpoint performance
- Webhook processing capacity
- Database performance under load

## Troubleshooting

### Common Issues

1. **Webhook Signature Verification Failed**
   - Check webhook secret configuration
   - Verify webhook URL in Stripe Dashboard
   - Ensure HTTPS is used

2. **Payment Intent Creation Failed**
   - Verify Stripe API key
   - Check amount and currency validation
   - Ensure user exists and is not deleted

3. **Subscription Creation Failed**
   - Verify plan exists and is active
   - Check payment method is valid
   - Ensure user doesn't have active subscription

4. **Database Migration Issues**
   - Check Prisma schema syntax
   - Verify database connection
   - Ensure all required fields are provided

## Support

For payment-related issues:
1. Check application logs for detailed error messages
2. Verify Stripe Dashboard for payment status
3. Review webhook event logs
4. Contact support with relevant error details

## Future Enhancements

1. **Multi-currency Support**
   - Dynamic currency conversion
   - Localized pricing
   - Tax calculation

2. **Advanced Subscription Features**
   - Proration handling
   - Upgrade/downgrade flows
   - Custom billing cycles

3. **Payment Analytics**
   - Revenue reporting
   - Churn analysis
   - Payment method analytics

4. **Enhanced Security**
   - 3D Secure integration
   - Fraud detection
   - PCI compliance tools 