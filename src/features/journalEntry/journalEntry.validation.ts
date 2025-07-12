import { z } from 'zod';

export const createJournalEntrySchema = z.object({
  tripId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  date: z.coerce.date(),
  isPublic: z.boolean().optional(),
  photos: z.array(z.string().url()).optional(), // URLs or file keys
});

export const updateJournalEntrySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  date: z.coerce.date().optional(),
  isPublic: z.boolean().optional(),
  photos: z.array(z.string().url()).optional(),
});

export const journalEntryIdParam = z.object({
  id: z.string().uuid(),
});

export const queryJournalEntriesSchema = z.object({
  tripId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
  search: z.string().optional(), // for RAG/semantic search
  skip: z.coerce.number().min(0).optional(),
  take: z.coerce.number().min(1).max(100).optional(),
}); 

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;