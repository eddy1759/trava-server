import { z } from 'zod';

const createDestination = z.object({
    body: z.object({
        name: z.string().min(1),
        country: z.string().min(1),
        description: z.string().min(1),
        imageUrl: z.string().url(),
        bestTimeToVisit: z.string().optional(),
        // We need the query to find the underlying Location model
        locationQuery: z.string().min(1, "A location query like 'Paris, France' is required."),
    }),
});

const updateDestination = z.object({
    body: createDestination.shape.body.partial(), // All fields are optional
    params: z.object({
        destinationId: z.string().uuid(),
    })
});

const getDestinations = z.object({
    query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        page: z.coerce.number().int().min(1).default(1),
    }),
});

const searchDestinations = z.object({
    query: z.object({
        q: z.string().min(1, "Search query is required."),
        limit: z.coerce.number().int().min(1).max(50).default(10),
    }),
});

export const destinationValidation = {
    createDestination,
    updateDestination,
    getDestinations,
    searchDestinations,
};