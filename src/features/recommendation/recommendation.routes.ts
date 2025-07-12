import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth';
import {
  generateRecommendations,
  getDestinationInsights,
  getBudgetOptimization,
  getStaticRecommendations,
  getAIRecommendations
} from './recommendation.controller';

const router = Router();

// Apply authentication to all recommendation routes
router.use(authMiddleware);

/**
 * @route POST /api/recommendations
 * @desc Generate smart recommendations for itinerary and budget
 * @access Private
 */
router.post('/', generateRecommendations);

/**
 * @route GET /api/recommendations/insights/:destinationName
 * @desc Get destination-specific insights
 * @access Private
 */
router.get('/insights/:destinationName', getDestinationInsights);

/**
 * @route POST /api/recommendations/budget-optimization
 * @desc Get budget optimization suggestions
 * @access Private
 */
router.post('/budget-optimization', getBudgetOptimization);

/**
 * @route GET /api/recommendations/static/:destinationName
 * @desc Get static recommendations for a destination
 * @access Private
 */
router.get('/static/:destinationName', getStaticRecommendations);

/**
 * @route POST /api/recommendations/ai
 * @desc Get AI-powered recommendations only
 * @access Private
 */
router.post('/ai', getAIRecommendations);

export default router; 