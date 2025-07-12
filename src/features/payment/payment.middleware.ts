import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';
import ApiError from '../../utils/ApiError';
import { stripeService } from './stripe.service';
import { body, validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';




// Middleware to validate Stripe webhook signature
export const validateStripeWebhook = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    logger.warn('Missing Stripe signature in webhook request', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      error: 'Missing Stripe signature'
    });
  }

  // The actual signature verification is handled in the Stripe service
  next();
};


/**
 * Middleware to ensure the request body for creating a payment intent is valid.
 * Uses express-validator for robust validation and clear error messages.
 */
export const validateCreatePaymentIntent = [
  body('amount').isFloat({ gt: 9.89 }).withMessage('Payment amount must be at least $9.90.'),
  body('amount').isFloat({ lt: 99.01 }).withMessage('Payment amount cannot exceed $99.'),
  body('currency').isIn(['USD', 'EUR', 'GBP']).withMessage('Invalid currency. Supported: USD, EUR, GBP.'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error(errors.array())
      throw ApiError.BadRequest('Validation failed');
    }
    next();
  },
];

/**
 * Middleware to validate the request body for creating a checkout session.
 */
export const validateCreateCheckout = [
  body('planId').isUUID().withMessage('A valid plan ID is required.'),
  body('successUrl').isURL().withMessage('A valid success URL is required.'),
  body('cancelUrl').isURL().withMessage('A valid cancel URL is required.'),
   (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error(errors.array())
      throw ApiError.BadRequest('Validation failed');
    }
    next();
  },
];


/**
 * Middleware to read the raw body of a request, which is required
 * for Stripe webhook signature verification.
 * IMPORTANT: This must be placed *before* any other body-parsing middleware (like express.json()).
 */
export const readRawBody = (req: Request, res: Response, next: NextFunction) => {
  if (req.originalUrl.startsWith('/api/v1/payments/webhook')) {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(chunks);
      next();
    });
  } else {
    next();
  }
};

/**
 * Middleware to handle the entire webhook processing flow.
 * It takes the raw body and signature, and calls the service to handle verification and processing.
 */
export const handleStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = (req as any).rawBody;

    if (!signature || !rawBody) {
      logger.warn('Webhook request missing signature or body.', { ip: req.ip });
      throw ApiError.BadRequest('Missing Stripe signature or body.');
    }

    // The service handles signature verification and all subsequent logic
    await stripeService.processWebhook(signature, rawBody, req.ip);

    // Send a 200 OK response to Stripe to acknowledge receipt of the event
    res.status(StatusCodes.OK).json({ received: true });
  } catch (error) {
    // The error is logged in the service, so we just pass it to the global error handler
    next(error);
  }
};