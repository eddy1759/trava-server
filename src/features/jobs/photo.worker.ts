import { Job } from 'bullmq';
import { prisma } from '../../services/prisma';
import { Prisma } from '@prisma/client';
import { ContentModerationService } from '../../services/contentModeration.service';
import logger from '../../utils/logger';
import { contentModerationQueue } from './queue';
import { PhotoStatus } from '@prisma/client'

interface PhotoProcessingJobData {
    photoId: string;
    userId: string;
}


export const photoWorkerHandler = async (job: Job<PhotoProcessingJobData>) => {
    logger.info(`Photo worker processing job '${job.name}' [${job.id}] for photo ${job.data.photoId}`);

    if (job.name === 'process-photo') {
        await handleProcessPhoto(job);
    } else {
        logger.warn(`Unknown job name in Photo queue: ${job.name}`);
        throw new Error(`Unknown job name: ${job.name}`);
    }
};

async function handleProcessPhoto(job: Job<PhotoProcessingJobData>) {
    const { photoId, userId } = job.data;

    const photo = await prisma.photo.findUnique({
        where: { id: photoId },
    });

    if (!photo) {
        logger.error(`Job ${job.id}: Photo with ID ${photoId} not found. Dropping job.`);
        return;
    }
    
    // Prevent reprocessing already completed or failed photos.
    if (photo.status !== PhotoStatus.PENDING) {
        logger.warn(`Job ${job.id}: Photo ${photoId} is not in PENDING state (current: ${photo.status}). Skipping.`);
        return;
    }

    try {
        await prisma.photo.update({
            where: { id: photoId },
            data: { status: PhotoStatus.PROCESSING },
        });

        // --- Step 1: Content Moderation (Caption and Image) ---
        let isApproved = true;
        let moderationReason = '';

        // 1a. Moderate caption
        if (photo.caption) {
            const captionResult = await ContentModerationService.moderateComment(photo.caption, userId);
            if (!captionResult.isApproved) {
                isApproved = false;
                moderationReason = `Caption failed moderation: ${captionResult.reason}`;
            }
        }

        // 1b. Moderate image (if caption is approved)
        // This would involve a service like AWS Rekognition.
        if (isApproved) {
            // const imageResult = await ContentModerationService.moderateImage(photo.url, userId);
            // if (!imageResult.isApproved) {
            //     isApproved = false;
            //     moderationReason = `Image failed moderation: ${imageResult.reason}`;
            // }
        }

        // --- Step 2: Image Optimization ---
        // This is where you'd download the image from the URL, process it with sharp,
        // and re-upload it to get a new, optimized URL.
        // For now, we'll simulate this.
        let optimizedUrl = photo.url; // In reality, this would change.
        // const optimizedUrl = await optimizeImage(photo.url);

        // --- Step 3: Finalize State ---
        const finalStatus = isApproved ? PhotoStatus.APPROVED : PhotoStatus.REJECTED;
        const finalUpdateData: Prisma.PhotoUpdateInput = {
            status: finalStatus,
            url: optimizedUrl,
            moderationReason: moderationReason || null,
        };

        await prisma.photo.update({
            where: { id: photoId },
            data: finalUpdateData,
        });

        logger.info(`Successfully processed photo ${photoId}. Final status: ${finalStatus}`);

    } catch (error) {
        logger.error(`Processing failed for photo ${photoId}:`, error);
        await prisma.photo.update({
            where: { id: photoId },
            data: {
                status: PhotoStatus.FAILED,
                moderationReason: error instanceof Error ? error.message : 'An unknown processing error occurred.',
            },
        });
        // Re-throw to let BullMQ handle the job failure (e.g., retry logic).
        throw error;
    }
} 