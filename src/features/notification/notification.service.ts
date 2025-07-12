import { prisma } from '../../services/prisma';
import ApiError from '../../utils/ApiError';
import { Notification, Prisma, NotificationType } from '@prisma/client';
import { emailService } from '../../services/email/email.service';
import logger from '../../utils/logger'

export interface notificationData {
    userId: string;
    itineraryItemId?: string;
    type: NotificationType;
    sendAt: Date;
    payload?: GenericEmailPayload;
}

export interface GenericEmailPayload {
  subject: string;
  message: string;
  url?: string;
}

async function createNotification(data: notificationData): Promise<Notification> {
  const { userId, type, payload } = data;

  if (!userId || !type) {
    throw ApiError.BadRequest('userId and type are required to create a notification.');
  }

  try {
    const notification = await prisma.$transaction(async (tx) => {
      // Step 1: Create the notification record in the database
      const newNotification = await tx.notification.create({
        data: {
          user: { connect: { id: data.userId } },
          ...(data.itineraryItemId && {
            itineraryItem: { connect: { id: data.itineraryItemId } }
          }),
          type: data.type,
          sendAt: new Date(),
          read: false,
          readAt: null,
          payload: data.payload ? JSON.stringify(data.payload) : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Step 2: If it's an email notification, send the email
      if (type === NotificationType.EMAIL) {
        if (!payload || !payload.message || !payload.subject) {
          throw ApiError.BadRequest('Email notifications require a payload with a subject and message.');
        }

        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { email: true, fullName: true },
        });

        if (!user || !user.email) {
          throw ApiError.NotFound(`User or user's email not found for userId: ${userId}`);
        }

        await emailService.sendGenericEmail({
          to: user.email,
          name: user.fullName?.split(' ')[0] || 'User',
          subject: payload.subject,
          message: payload.message,
          url: payload.url,
        });
      }

      return newNotification;
    });

    return notification;
  } catch (error: any) {
    logger.error('Failed to create notification:', {
      error: error.message,
      userId,
      type,
    });

    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError('Failed to create notification due to an internal error.', 500);
  }
}

async function getNotificationById(id: string): Promise<Notification> {
  if (!id) throw ApiError.BadRequest('Notification ID is required.');
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) throw ApiError.NotFound('Notification not found');
  return notification;
}

async function updateNotification(id: string, data: Partial<Notification> & { read?: boolean }): Promise<Notification> {
  if (!id) throw ApiError.BadRequest('Notification ID is required.');

  const updateData: Prisma.NotificationUpdateInput = { ...data };

  // Handle marking as read/unread
  if (typeof data.read === 'boolean') {
    updateData.readAt = data.read ? new Date() : null;
  }
  delete updateData.read; // Remove from the final data object

  try {
    return await prisma.notification.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });
  } catch (error: any) {
    logger.error('Failed to update notification:', { error: error.message, notificationId: id });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw ApiError.NotFound('Notification not found.');
    }
    throw new ApiError('Failed to update notification.', 500);
  }
}

async function deleteNotification(id: string): Promise<void> {
  if (!id) throw ApiError.BadRequest('Notification ID is required.');
  try {
    await prisma.notification.delete({ where: { id } });
  } catch (error: any) {
    logger.error('Failed to delete notification:', { error: error.message, notificationId: id });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw ApiError.NotFound('Notification not found.');
    }
    throw new ApiError('Failed to delete notification.', 500);
  }
}

async function listNotifications(params: {
  userId?: string;
  type?: NotificationType;
  unread?: boolean;
  skip?: number;
  take?: number;
}): Promise<Notification[]> {
  const { userId, type, unread, skip = 0, take = 20 } = params;

  const where: Prisma.NotificationWhereInput = {};
  if (userId) where.userId = userId;
  if (type) where.type = type;
  if (typeof unread === 'boolean') {
    where.readAt = unread ? null : { not: null };
  }

  return prisma.notification.findMany({
    where,
    skip,
    take,
    orderBy: { createdAt: 'desc' }, // Order by creation date for a more standard timeline
  });
}

async function getUserEmail(userId: string): Promise<string> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.email) throw ApiError.NotFound('User email not found');
    return user.email;
}

export const notificationService = {
  createNotification,
  getNotificationById,
  updateNotification,
  deleteNotification,
  listNotifications,
};
