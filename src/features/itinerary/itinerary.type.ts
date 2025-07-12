import { ItineraryItemCategory } from '@prisma/client';

export type CreateItineraryData = {
    title: string;
    category: ItineraryItemCategory;
    startTime: Date | string;
    tripId: string;
    description?: string;
    endTime?: Date | string;
    locationQuery?: string;
    isAISuggestion?: boolean;
    locationId?: string;
};

export interface CreateItineraryItemData {
  tripId: string;
  title: string;
  description?: string;
  category: ItineraryItemCategory;
  startTime: Date;
  endTime?: Date;
  locationId?: string;
  isAISuggestion?: boolean;
}

export interface UpdateItineraryItemData {
  title?: string;
  description?: string;
  category?: ItineraryItemCategory;
  startTime?: Date;
  endTime?: Date;
  locationId?: string;
}

export interface ItinerarySuggestionRequest {
  tripId: string;
  destinationName: string;
  startDate: Date;
  endDate: Date;
  budget: number;
  preferences?: string[];
}