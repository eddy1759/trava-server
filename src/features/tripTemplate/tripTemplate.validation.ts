import { z } from 'zod';

export const createTripTemplateSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000),
  durationInDays: z.number().int().min(1),
  destinationId: z.string().uuid(),
  templateItems: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    day: z.number().int().min(1),
    time: z.string().optional(),
  })),
});

export const updateTripTemplateSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  durationInDays: z.number().int().min(1).optional(),
  templateItems: z.array(z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    day: z.number().int().min(1),
    time: z.string().optional(),
  })).optional(),
});

export const tripTemplateIdParam = z.object({
  id: z.string().uuid(),
});

export const queryTripTemplatesSchema = z.object({
  query: z.object({
    destinationId: z.string().uuid().optional(),
    search: z.string().optional(),
    skip: z.coerce.number().min(0).optional(),
    take: z.coerce.number().min(1).max(100).optional(),
  })
}); 