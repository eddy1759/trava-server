import { Router } from 'express';
import { authMiddleware, adminOnly } from '../../middlewares/auth';
import * as destinationController  from './destination.controller';
import { validateBody, validateParams } from '../../middlewares/validation.middleware';
import { destinationValidation } from './destination.validation';

const destinationRouter = Router();

// --- Public Routes ---

// Get all curated destinations, with pagination
destinationRouter.get(
    '/', 
    validateBody(destinationValidation.getDestinations),
    destinationController.getAllDestinationsHandler
);

// Search for destinations based on a query string
destinationRouter.get(
    '/search', 
    validateBody(destinationValidation.searchDestinations),
    destinationController.searchDestinationsHandler
);

// --- Admin-Only Routes ---

// Create a new curated destination
destinationRouter.post(
    '/', 
    authMiddleware, 
    adminOnly, 
    validateBody(destinationValidation.createDestination),
    destinationController.createDestinationHandler
);

// Update an existing curated destination
destinationRouter.patch(
    '/:destinationId', 
    authMiddleware, 
    adminOnly, 
    validateParams(destinationValidation.updateDestination),
    destinationController.updateDestinationHandler
);

export default destinationRouter;