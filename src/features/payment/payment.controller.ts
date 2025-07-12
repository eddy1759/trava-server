import { Request, Response} from 'express';
import { paymentService } from './payment.service';
import { stripeService } from './stripe.service';
import { StatusCodes } from 'http-status-codes';
import ApiError from '../../utils/ApiError';
import logger from '../../utils/logger';
import { asyncWrapper } from '../../utils/asyncWrapper';

class PaymentController {
  /**
   * Create a one-time payment
   */
  createPayment = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;

    const result = await paymentService.createPaymentIntent(userId, req.body);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Payment Created Successfully",
      data: result
    });
  });

  /**
   * Create a Stripe Checkout Session for subscription
   */
  createCheckoutSession = asyncWrapper(async (req: Request, res: Response) => {
    const { planId, successUrl, cancelUrl, metadata } = req.body;
    const userId = req.user?.id;
    const data = { planId, successUrl, cancelUrl, metadata, userId }

    const result = await paymentService.createCheckoutSession(data);

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Check session created",
      data: result
    });
  });

  
  /**
   * Cancel a subscription
   */
  cancelSubscription = asyncWrapper(async (req: Request, res: Response) => {
    const { subscriptionId } = req.params;
    const { cancelAtPeriodEnd = true } = req.body;
    const userId = req.user.id;

    await paymentService.cancelSubscription(userId, subscriptionId, cancelAtPeriodEnd);

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  });

  /**
   * Get payment by ID
   */
  getPayment = asyncWrapper(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    const userId = req.user.id;

    const payment = await paymentService.getPayment(paymentId, userId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Payment fetched successfully",
      data: payment
    });
  });

  /**
   * Get user's active subscription
   */
  getUserActiveSubscription = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;

    const subscription = await paymentService.getUserActiveSubscription(userId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Active subscription fetched successfully",
      data: subscription
    });
  });

  /**
   * Get user's payment history
   */
  getUserPaymentHistory = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const payments = await paymentService.getUserPaymentHistory(userId, limit, offset);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Payment history fetched successfully",
      data: payments
    });
  });

  /**
   * Get available subscription plans
   */
  getSubscriptionPlans = asyncWrapper(async (req: Request, res: Response)=> {
    const plans = await paymentService.getSubscriptionPlans();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Subscription plan fetched successfully",
      data: plans
    });
  });

  /**
   * Get user's payment statistics
   */
  getUserPaymentStats = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;

    const stats = await paymentService.getUserPaymentStats(userId);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "User payment statitics fetched successfully",
      data: stats
    });
  });
}

export const paymentController = new PaymentController(); 