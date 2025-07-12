import { z } from 'zod';
import { NotificationType } from '@prisma/client';

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  itineraryItemId: z.string().uuid().optional(),
  type: z.enum([NotificationType.EMAIL, NotificationType.PUSH_NOTIFICATION]),
  sendAt: z.coerce.date(),
  payload: z.object({
    subject: z.string().optional(),
    message: z.string(),
    url: z.string().url().optional(),
  }).optional(),
});

export const updateNotificationSchema = z.object({
  sentAt: z.coerce.date().optional(),
  read: z.boolean().optional(),
});

export const notificationIdParam = z.object({
  id: z.string().uuid(),
});

export const queryNotificationsSchema = z.object({
  userId: z.string().uuid().optional(),
  type: z.enum([NotificationType.EMAIL, NotificationType.PUSH_NOTIFICATION]).optional(),
  unread: z.boolean().optional(),
  skip: z.coerce.number().min(0).optional(),
  take: z.coerce.number().min(1).max(100).optional(),
}); 