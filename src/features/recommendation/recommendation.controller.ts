import { Request, Response } from 'express';
import { recommendationService, RecommendationRequest } from '../../services/recommendation.service';
import { asyncWrapper } from '../../utils/asyncWrapper';
import logger from '../../utils/logger';

/**
 * Generate smart recommendations for itinerary and budget
 */
export const generateRecommendations = asyncWrapper(async (req: Request, res: Response) => {
  const {
    destinationName,
    tripDuration,
    budget,
    preferences,
    travelStyle,
    interests,
    groupSize
  } = req.body;

  if (!destinationName || !tripDuration || !budget) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: destinationName, tripDuration, budget'
    });
  }

  const request: RecommendationRequest = {
    destinationName,
    tripDuration,
    budget,
    preferences,
    travelStyle,
    interests,
    groupSize
  };

  const recommendations = await recommendationService.generateSmartRecommendations(request);

  logger.info(`Generated recommendations for ${destinationName}`, {
    userId: req.user?.id,
    destination: destinationName,
    duration: tripDuration,
    budget
  });

  res.status(200).json({
    success: true,
    data: recommendations
  });
});

/**
 * Get destination-specific insights
 */
export const getDestinationInsights = asyncWrapper(async (req: Request, res: Response) => {
  const { destinationName } = req.params;

  if (!destinationName) {
    return res.status(400).json({
      success: false,
      message: 'Destination name is required'
    });
  }

  const insights = await recommendationService.getDestinationInsights(destinationName);

  logger.info(`Retrieved insights for ${destinationName}`, {
    userId: req.user?.id,
    destination: destinationName
  });

  res.status(200).json({
    success: true,
    data: {
      destination: destinationName,
      insights
    }
  });
});

/**
 * Get budget optimization suggestions
 */
export const getBudgetOptimization = asyncWrapper(async (req: Request, res: Response) => {
  const {
    destinationName,
    currentBudget,
    currentExpenses,
    preferences
  } = req.body;

  if (!destinationName || !currentBudget) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: destinationName, currentBudget'
    });
  }

  const optimization = await recommendationService.getBudgetOptimization(
    destinationName,
    currentBudget,
    currentExpenses || [],
    preferences
  );

  logger.info(`Generated budget optimization for ${destinationName}`, {
    userId: req.user?.id,
    destination: destinationName,
    budget: currentBudget
  });

  res.status(200).json({
    success: true,
    data: optimization
  });
});

/**
 * Get static recommendations for a destination
 */
export const getStaticRecommendations = asyncWrapper(async (req: Request, res: Response) => {
  const { destinationName } = req.params;
  const { tripDuration = 7, budget = 1000 } = req.query;

  if (!destinationName) {
    return res.status(400).json({
      success: false,
      message: 'Destination name is required'
    });
  }

  const request: RecommendationRequest = {
    destinationName,
    tripDuration: Number(tripDuration),
    budget: Number(budget)
  };

  // Use fallback method to get only static recommendations
  const recommendations = await recommendationService.generateSmartRecommendations(request);

  logger.info(`Retrieved static recommendations for ${destinationName}`, {
    userId: req.user?.id,
    destination: destinationName,
    duration: tripDuration,
    budget
  });

  res.status(200).json({
    success: true,
    data: {
      destination: destinationName,
      recommendations: {
        itinerary: recommendations.itinerary.filter(item => item.source === 'static'),
        budget: recommendations.budget.filter(item => item.source === 'static'),
        totalEstimatedCost: recommendations.totalEstimatedCost,
        budgetUtilization: recommendations.budgetUtilization
      }
    }
  });
});

/**
 * Get AI-powered recommendations only
 */
export const getAIRecommendations = asyncWrapper(async (req: Request, res: Response) => {
  const {
    destinationName,
    tripDuration,
    budget,
    preferences,
    travelStyle,
    interests,
    groupSize
  } = req.body;

  if (!destinationName || !tripDuration || !budget) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: destinationName, tripDuration, budget'
    });
  }

  const request: RecommendationRequest = {
    destinationName,
    tripDuration,
    budget,
    preferences,
    travelStyle,
    interests,
    groupSize
  };

  // Get AI insights and budget optimization
  const [insights, budgetOptimization] = await Promise.all([
    recommendationService.getDestinationInsights(destinationName),
    recommendationService.getBudgetOptimization(destinationName, budget, [], preferences)
  ]);

  logger.info(`Generated AI recommendations for ${destinationName}`, {
    userId: req.user?.id,
    destination: destinationName,
    duration: tripDuration,
    budget
  });

  res.status(200).json({
    success: true,
    data: {
      destination: destinationName,
      insights,
      budgetOptimization,
      aiGenerated: true
    }
  });
}); 