import { z } from 'zod';

export const createPhotoSchema = z.object({
  journalEntryId: z.string().uuid({ message: "Invalid Journal Entry ID" }),
  caption: z.string().max(500).optional(),
  isPublic: z.preprocess((val) => {
    if (typeof val === 'string') return val === 'true';
    if (typeof val === 'boolean') return val;
    return false; // Default to false if undefined or another type
  }, z.boolean().optional()),
})

export const bulkUploadPhotoSchema = z.object({
  journalEntryId: z.string().uuid(),
  photos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().max(500).optional(),
    isPublic: z.boolean().optional(),
  })).min(1),
});

export const commentSchema = z.object({
  journalEntryId: z.string().uuid(),
  content: z.string().min(1).max(1000),
});