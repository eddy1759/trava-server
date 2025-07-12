import { Job } from 'bullmq';
import { prisma } from '../../services/prisma';
import { ContentModerationService } from '../../services/contentModeration.service';
import logger from '../../utils/logger';
import { JournalStatus, CommentStatus, PhotoStatus } from '@prisma/client';

interface ContentModerationJob {
    contentId: string;
    userId: string;
    content: string;
    contentType: 'comment' | 'photo_caption' | 'journal_entry';
    reason: string;
}

export const contentModerationWorkerHandler = async (job: Job) => {
    logger.info(`Content moderation worker processing job '${job.name}' [${job.id}]`);
    
    switch (job.name) {
        case 'moderate-comment':
            await handleModerateComment(job);
            break;
        case 'moderate-photo-caption':
            await handleModeratePhotoCaption(job);
            break;
        case 'moderate-journal-entry': // NEW: Added handler for journal entries
            await handleModerateJournalEntry(job);
            break;
        default:
            throw new Error(`Unknown job name in Content Moderation queue: ${job.name}`);
    }
};

async function handleModerateComment(job: Job<ContentModerationJob>) {
    const { contentId, userId, content } = job.data;
    
    logger.info(`Moderating comment ${contentId} for user ${userId}`);

    try {
        const moderationResult = await ContentModerationService.moderateComment(content, userId);
        
        if (!moderationResult.isApproved) {
            await prisma.photoComment.update({
                where: { id: contentId },
                data: { 
                    status: CommentStatus.REJECTED,
                    moderationReason: moderationResult.reason
                }
            });
            
            logger.warn(`Comment ${contentId} failed moderation: ${moderationResult.reason}`);
            return;
        }

        await prisma.photoComment.update({
            where: { id: contentId },
            data: { 
                content: moderationResult.moderatedContent,
                status: CommentStatus.APPROVED
            }
        });

        logger.info(`Comment ${contentId} moderation completed successfully`);
    } catch (error) {
        logger.error(`Failed to moderate comment ${contentId}:`, error);
        // If an unexpected error occurs, set status to MODERATION_FAILED
        await prisma.photoComment.update({
            where: { id: contentId },
            data: {
                status: CommentStatus.MODERATION_FAILED,
                moderationReason: 'An internal error occurred during moderation.'
            }
        });
    }
}

async function handleModeratePhotoCaption(job: Job<ContentModerationJob>) {
    const { contentId, userId, content } = job.data;
    
    logger.info(`Moderating photo caption ${contentId} for user ${userId}`);

    try {
        const moderationResult = await ContentModerationService.moderateContent(content, userId);
        
        if (!moderationResult.isApproved) {
            await prisma.photo.update({
                where: { id: contentId },
                data: { 
                    status: PhotoStatus.REJECTED,
                    moderationReason: moderationResult.reason
                }
            });
            
            logger.warn(`Photo caption ${contentId} failed moderation: ${moderationResult.reason}`);
            return;
        }

        await prisma.photo.update({
            where: { id: contentId },
            data: { 
                caption: moderationResult.moderatedContent,
                status: PhotoStatus.APPROVED
            }
        });

        logger.info(`Photo caption ${contentId} moderation completed successfully`);
    } catch (error) {
        logger.error(`Failed to moderate photo ${contentId}:`, error);
        // If an unexpected error occurs, set status to MODERATION_FAILED
        await prisma.photo.update({
            where: { id: contentId },
            data: {
                status: CommentStatus.MODERATION_FAILED,
                moderationReason: 'An internal error occurred during moderation.'
            }
        });
    }
} 

async function handleModerateJournalEntry(job: Job<ContentModerationJob>) {
    const { contentId, userId, content } = job.data;

    logger.info(`Moderating journal entry ${contentId} for user ${userId}`);

    try {
        const moderationResult = await ContentModerationService.moderateJournalEntry(content, userId);
        console.log('Moderation result:', moderationResult);
        
        if (!moderationResult.isApproved) {
            await prisma.journalEntry.update({
                where: { id: contentId },
                data: { 
                    journalStatus: JournalStatus.REJECTED,
                    moderationReason: moderationResult.reason
                }
            });
            
            logger.warn(`Journal entry ${contentId} failed moderation: ${moderationResult.reason}`);
            return;
        }

        await prisma.journalEntry.update({
            where: { id: contentId },
            data: { 
                content: moderationResult.moderatedContent,
                journalStatus: JournalStatus.APPROVED,
            }
        });

        logger.info(`Journal entry ${contentId} moderation completed successfully`);
    } catch (error) {
        logger.error(`Failed to moderate journal entry ${contentId}:`, error);
        // If an unexpected error occurs, set status to MODERATION_FAILED
        await prisma.journalEntry.update({
            where: { id: contentId },
            data: {
                journalStatus: JournalStatus.MODERATION_FAILED,
                moderationReason: 'An internal error occurred during moderation.'
            }
        });
        
    }
}