import { Router } from 'express';
import * as tripController from './trip.controller';
import { authMiddleware } from '../../middlewares/auth';
import { requirePremium, checkSubscriptionLimits, addUsageHeaders } from '../../middlewares/premium.middleware';
import { validateBody } from '../../middlewares/validation.middleware';
import { createTripSchema, updateTripSchemaStatus, updateTripPrivacySchema } from './trip.validation';

const tripRouter = Router();

// Apply authentication to all routes
tripRouter.use(authMiddleware);

// Trip creation with premium gating
tripRouter.post('/', 
  addUsageHeaders('trips'),
  checkSubscriptionLimits('trips', 5), // Free users can create 5 trips
  validateBody(createTripSchema), 
  tripController.createTripHandler
);

tripRouter.get('/', authMiddleware, tripController.getTripsByUserHandler);

tripRouter.get('/:tripId', authMiddleware, tripController.getTripByIdHandler);

tripRouter.patch('/:tripId/status', authMiddleware, validateBody(updateTripSchemaStatus), tripController.updateTripStatusHandler);

tripRouter.patch(
    '/:tripId/privacy',
    authMiddleware,
    validateBody(updateTripPrivacySchema),
    tripController.updateTripPrivacyHandler
)


export default tripRouter;
