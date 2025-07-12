import { Router } from 'express';
import { itineraryController } from './itinerary.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validation.middleware'
import { itineraryValidation } from './itinerary.validation'

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);


router.post('/', validateBody(itineraryValidation.createItineraryItemSchema), itineraryController.createItineraryItem);


router.get('/trip/:tripId', itineraryController.getTripItinerary);

router.put('/:itemId', validateBody(itineraryValidation.updateItineraryItemSchema), itineraryController.updateItineraryItem);

router.delete('/:itemId', itineraryController.deleteItineraryItem);


router.post('/suggestions', validateBody(itineraryValidation.generateSuggestionsSchema), itineraryController.generateSuggestions);

router.get('/trip/:tripId/stats', itineraryController.getItineraryStats);

router.put('/trip/:tripId/reorder', itineraryController.reorderItems);

router.post('/:itemId/duplicate', itineraryController.duplicateItem);

router.post('/smart-recommendations', validateBody(itineraryValidation.smartRecommendationsSchema), itineraryController.generateSmartRecommendations);

router.get('/insights', validateQuery(itineraryValidation.destinationNameSchema), itineraryController.getDestinationInsights);

router.post('/budget-optimization', itineraryController.getBudgetOptimization);

export default router;