import { z } from 'zod';
import { ItineraryItemCategory } from '@prisma/client';

const createItineraryItemSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    tripId: z.string().uuid('Trip ID must be a valid UUID'),
    description: z.string().optional(),
    category: z.nativeEnum(ItineraryItemCategory),
    startTime: z.string().datetime('Start time must be a valid ISO date string'),
    endTime: z.string().datetime('End time must be a valid ISO date string').optional(),
    locationQuery: z.string().optional(), // e.g., "Eiffel Tower, Paris"
});


const updateItineraryItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: z.nativeEnum(ItineraryItemCategory).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  locationId: z.string().uuid().optional(),
});

const generateSuggestionsSchema = z.object({
  tripId: z.string().uuid(),
  destinationName: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  budget: z.number().positive(),
  preferences: z.array(z.string()).optional(),
});

const getDayItinerarySchema = z.object({
  tripId: z.string().uuid(),
  date: z.string().datetime(),
});

const smartRecommendationsSchema = z.object({
  destinationName: z.string().min(1),
  tripDuration: z.number().positive(),
  budget: z.number().positive(),
  preferences: z.array(z.string()).optional(),
  travelStyle: z.enum(['budget', 'mid-range', 'luxury']).optional(),
  interests: z.array(z.string()).optional(),
  groupSize: z.number().positive().optional(),
});

const destinationNameSchema = z.object({
  destinationName: z.string().max(150)
})

export const itineraryValidation = {
  createItineraryItemSchema,
  updateItineraryItemSchema,
  generateSuggestionsSchema,
  getDayItinerarySchema,
  smartRecommendationsSchema,
  destinationNameSchema
};