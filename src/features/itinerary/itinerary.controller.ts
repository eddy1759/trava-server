import { Request, Response } from 'express';
import { asyncWrapper } from '../../utils/asyncWrapper';
import { itineraryService } from './itinerary.service';
import { ItineraryItemCategory } from '@prisma/client';
import logger from '../../utils/logger';
import { itineraryValidation } from './itinerary.validation';
import { StatusCodes } from 'http-status-codes';


const createItineraryItem = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const itineraryItem = await itineraryService.createItineraryItem(userId, req.body);

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Itinerary item created successfully',
    data: itineraryItem,
  });
});

const getTripItinerary = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const userId = req.user?.id;
  
  if (!tripId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID is required',
    });
  }

  const itineraryItems = await itineraryService.getItineraryForTrip(tripId, userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Retrieved ${itineraryItems.length} itinerary items for trip ${tripId}`,
    data: itineraryItems,
  });
});


const updateItineraryItem = asyncWrapper(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const userId = req.user?.id;
  const validatedData = itineraryValidation.updateItineraryItemSchema.parse(req.body);

  if (!itemId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Item ID is required',
    });
  }

  const updatedData: any = { ...validatedData };
  if (validatedData.startTime) {
    updatedData.startTime = new Date(validatedData.startTime);
  }
  if (validatedData.endTime) {
    updatedData.endTime = new Date(validatedData.endTime);
  }

  const itineraryItem = await itineraryService.updateItineraryItem(itemId, userId, updatedData);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Itinerary item updated successfully',
    data: itineraryItem,
  });
});


const deleteItineraryItem = asyncWrapper(async (req: Request, res: Response) => {
    const { itemId } = req.params;
  const userId = req.user?.id;
  
  if (!itemId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Item ID is required',
    });
  }

  await itineraryService.deleteItineraryItem(itemId, userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Itinerary item deleted successfully',
  });
});


const generateSuggestions = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const validatedData = itineraryValidation.generateSuggestionsSchema.parse(req.body);

  const suggestions = await itineraryService.generateUserItinerarySuggestions(userId, {
    tripId: validatedData.tripId,
    destinationName: validatedData.destinationName,
    startDate: new Date(validatedData.startDate),
    endDate: new Date(validatedData.endDate),
    budget: validatedData.budget,
    preferences: validatedData.preferences,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Itinerary suggestions generated successfully',
    data: suggestions
  });
});


const getItineraryStats = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  
  if (!tripId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID is required',
    });
  }

  const stats = await itineraryService.getItineraryStats(tripId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Retrieved itinerary statistics successfully',
    data: stats,
  });
});


const generateSmartRecommendations = asyncWrapper(async (req: Request, res: Response) => {
  const validatedData = itineraryValidation.smartRecommendationsSchema.parse(req.body);

  const recommendations = await itineraryService.generateSmartItineraryRecommendations({
    destinationName: validatedData.destinationName,
    tripDuration: validatedData.tripDuration,
    budget: validatedData.budget,
    preferences: validatedData.preferences,
    travelStyle: validatedData.travelStyle,
    interests: validatedData.interests,
    groupSize: validatedData.groupSize,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Smart itinerary recommendations generated successfully',
    data: recommendations,
  });
});


const getDestinationInsights = asyncWrapper(async (req: Request, res: Response) => {
  const { destinationName } = req.query;
  
  if (!destinationName || typeof destinationName !== 'string') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Destination name is required',
    });
  }

  const insights = await itineraryService.getDestinationInsights(destinationName);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Retrieved insights for ${destinationName}`,
    data: insights,
  });
});


const getBudgetOptimization = asyncWrapper(async (req: Request, res: Response) => {
  const { destinationName, currentBudget, currentExpenses, preferences } = req.body;
  
  if (!destinationName || !currentBudget) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Destination name and current budget are required',
    });
  }

  const optimization = await itineraryService.getBudgetOptimization(
    destinationName,
    currentBudget,
    currentExpenses || [],
    preferences
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Budget optimization suggestions retrieved successfully',
    data: optimization,
  });
});



const reorderItems = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const { itemIds } = req.body; // Array of item IDs in new order
  const userId = req.user?.id;
  
  if (!tripId || !Array.isArray(itemIds)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID and itemIds array are required',
    });
  }

  // Update start times to reflect new order
  const updates = [];
  for (let i = 0; i < itemIds.length; i++) {
    const startTime = new Date();
    startTime.setHours(9 + i * 2, 0, 0, 0); // Spread items throughout the day
    
    updates.push(
      itineraryService.updateItineraryItem(itemIds[i], userId, { startTime })
    );
  }

  const reorderedItems = await Promise.all(updates);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Itinerary items reordered successfully',
    data: reorderedItems,
  });
});


const duplicateItem = asyncWrapper(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  const userId = req.user?.id;
  
  if (!itemId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Item ID is required',
    });
  }

  // Get the original item
  const originalItem = await itineraryService.getById(userId, itemId);

  if (!originalItem) {
    return res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: 'Itinerary item not found',
    });
  }

  const item = originalItem[0];
  
  // Create a copy with adjusted time
  const newStartTime = new Date(item.startTime);
  newStartTime.setHours(newStartTime.getHours() + 2); // Move 2 hours later
  
  const newEndTime = item.endTime ? new Date(item.endTime) : undefined;
  if (newEndTime) {
    newEndTime.setHours(newEndTime.getHours() + 2);
  }

  const duplicatedItem = await itineraryService.createItineraryItem(userId, {
    tripId: item.tripId,
    title: `${item.title} (Duplicate)`,
    description: item.description,
    category: item.category,
    startTime: newStartTime,
    endTime: newEndTime,
    locationId: item.locationId,
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Itinerary item duplicated successfully',
    data: duplicatedItem
  });
});

export const itineraryController = {
  createItineraryItem,
  getTripItinerary,
  updateItineraryItem,
  deleteItineraryItem,
  generateSuggestions,
  getItineraryStats,
  generateSmartRecommendations,
  getDestinationInsights,
  getBudgetOptimization,
  reorderItems,
  duplicateItem
};