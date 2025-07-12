import { z } from 'zod';

export const tripIdParam = z.object({
  tripId: z.string().uuid(),
});

export const commentIdParam = z.object({
  commentId: z.string().uuid(),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const getCommentsSchema = z.object({
  query: z.object({
    skip: z.coerce.number().min(0).optional(),
    take: z.coerce.number().min(1).max(100).optional(),
  })
});

export const getUserCommentsSchema = z.object({
  query: z.object({
    skip: z.coerce.number().min(0).optional(),
    take: z.coerce.number().min(1).max(100).optional(),
  })
}); 