import { Job } from 'bullmq';
import { prisma } from '../../services/prisma';
import { amqpWrapper } from '../../services/amqpWrapper';
import { notificationQueue } from './queue';
import logger from '../../utils/logger';

interface NotificationJob {
    userId: string;
    type: 'EMAIL' | 'PUSH_NOTIFICATION';
    title: string;
    message: string;
    data?: Record<string, any>;
    itineraryItemId?: string;
}

interface SocialNotificationJob {
    userId: string;
    actionType: 'like' | 'comment' | 'follow';
    actorId: string;
    targetId: string;
    targetType: 'photo' | 'journal_entry' | 'trip';
}

export const notificationWorkerHandler = async (job: Job) => {
    logger.info(`Notification worker processing job '${job.name}' [${job.id}]`);
    
    switch (job.name) {
        case 'send-notification':
            await handleSendNotification(job);
            break;
        case 'send-social-notification':
            await handleSendSocialNotification(job);
            break;
        case 'send-bulk-notification':
            await handleSendBulkNotification(job);
            break;
        default:
            throw new Error(`Unknown job name in Notification queue: ${job.name}`);
    }
};

async function handleSendNotification(job: Job<NotificationJob>) {
    const { userId, type, title, message, data, itineraryItemId } = job.data;
    
    logger.info(`Sending ${type} notification to user ${userId}`);

    try {
        // Get user email for email notifications
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, fullName: true }
        });

        if (!user) {
            logger.warn(`User ${userId} not found for notification`);
            return;
        }

        // Get user settings
        const userSettings = await prisma.userSettings.findUnique({
            where: { userId },
            select: { receivesNotifications: true }
        });

        if (!userSettings?.receivesNotifications) {
            logger.info(`User ${userId} has notifications disabled`);
            return;
        }

        // Create notification record
        const notificationData: any = {
            userId,
            type,
            sendAt: new Date(),
            payload: {
                title,
                message,
                data: data || {}
            }
        };

        if (itineraryItemId) {
            notificationData.itineraryItemId = itineraryItemId;
        }

        const notification = await prisma.notification.create({
            data: notificationData
        });

        // Send email notification if type is EMAIL
        if (type === 'EMAIL' && user.email) {
            await amqpWrapper.sendEmailQueue({
                to: user.email,
                type: 'notification',
                fullName: user.fullName || 'User',
                notificationData: {
                    title,
                    message,
                    type,
                    data
                }
            });
        }

        logger.info(`Notification ${notification.id} sent successfully to user ${userId}`);
    } catch (error) {
        logger.error(`Failed to send notification to user ${userId}:`, error);
        throw error;
    }
}

async function handleSendSocialNotification(job: Job<SocialNotificationJob>) {
    const { userId, actionType, actorId, targetId, targetType } = job.data;
    
    logger.info(`Sending social notification for ${actionType} on ${targetType} ${targetId}`);

    try {
        // Get actor information
        const actor = await prisma.user.findUnique({
            where: { id: actorId },
            select: { fullName: true, email: true }
        });

        if (!actor) {
            logger.warn(`Actor ${actorId} not found for social notification`);
            return;
        }

        // Get target information
        let targetInfo: any = {};
        switch (targetType) {
            case 'photo':
                targetInfo = await prisma.photo.findUnique({
                    where: { id: targetId },
                    select: { caption: true }
                });
                break;
            case 'journal_entry':
                targetInfo = await prisma.journalEntry.findUnique({
                    where: { id: targetId },
                    select: { title: true }
                });
                break;
            case 'trip':
                targetInfo = await prisma.trip.findUnique({
                    where: { id: targetId },
                    select: { tripName: true }
                });
                break;
        }

        // Create notification message
        const actionText = actionType === 'like' ? 'liked' : actionType === 'comment' ? 'commented on' : 'started following';
        const targetText = targetType === 'photo' ? 'your photo' : 
                          targetType === 'journal_entry' ? 'your journal entry' : 
                          targetType === 'trip' ? 'your trip' : 'your content';

        const title = `${actor.fullName || 'Someone'} ${actionText} ${targetText}`;
        const message = `${actor.fullName || 'Someone'} ${actionText} ${targetText}`;

        // Queue the notification
        await notificationQueue.add('send-notification', {
            userId,
            type: 'PUSH_NOTIFICATION',
            title,
            message,
            data: {
                actorId,
                actorName: actor.fullName || 'Someone',
                actionType,
                targetId,
                targetType,
                targetInfo
            }
        });

        logger.info(`Social notification queued for user ${userId}`);
    } catch (error) {
        logger.error(`Failed to send social notification:`, error);
        throw error;
    }
}

async function handleSendBulkNotification(job: Job) {
    const { userIds, type, title, message, data, itineraryItemId } = job.data;
    
    logger.info(`Sending bulk notification to ${userIds.length} users`);

    try {
        const notificationJobs = userIds.map(userId => ({
            name: 'send-notification',
            data: {
                userId,
                type,
                title,
                message,
                data,
                itineraryItemId
            }
        }));

        await Promise.all(
            notificationJobs.map(jobData => 
                notificationQueue.add(jobData.name, jobData.data)
            )
        );

        logger.info(`Bulk notification queued for ${userIds.length} users`);
    } catch (error) {
        logger.error(`Failed to send bulk notification:`, error);
        throw error;
    }
} 