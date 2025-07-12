import { prisma } from '../../services/prisma';
import { CollaboratorRole, PhotoStatus, Prisma } from '@prisma/client';
import ApiError from '../../utils/ApiError';
import { photoQueue} from '../jobs/queue';
import logger from '../../utils/logger';
import { storageService } from "../../services/storage.service"

async function _verifyUserPermission(
    journalEntryId: string,
    userId: string,
    requiredRole: CollaboratorRole = CollaboratorRole.VIEWER
) {
    const entry = await prisma.journalEntry.findUnique({
        where: { id: journalEntryId },
        select: {
            trip: {
                select: {
                    ownerId: true,
                    collaborators: {
                        where: { userId },
                        select: { role: true },
                    },
                },
            },
        },
    });

    if (!entry) {
        throw ApiError.NotFound('Journal entry not found.');
    }

    const { trip } = entry;
    if (trip.ownerId === userId) {
        return; // Owner has all permissions.
    }

    const collaborator = trip.collaborators[0];
    if (!collaborator) {
        throw ApiError.Forbidden('You are not a collaborator on this trip.');
    }

    // Check if the user's role is sufficient. EDITOR can do anything a VIEWER can.
    const hasPermission = requiredRole === CollaboratorRole.VIEWER || collaborator.role === CollaboratorRole.EDITOR;

    if (!hasPermission) {
        throw ApiError.Forbidden(`You do not have permission to perform this action. Required role: ${requiredRole}`);
    }
}

async function createPhoto(data: { journalEntryId: string; url: string; caption?: string; userId: string; isPublic?: boolean }) {

  await _verifyUserPermission(data.journalEntryId, data.userId, CollaboratorRole.EDITOR);

  const photo = await prisma.photo.create({
    data: {
      journalEntryId: data.journalEntryId,
      url: data.url,
      caption: data.caption,
      isPublic: data.isPublic ?? false,
      status: PhotoStatus.PENDING // Set initial status
    },
  });

  // Queue photo processing
  try {
    await photoQueue.add('process-photo', {
      photoId: photo.id,
      userId: data.userId,
    });
    logger.info(`Photo ${photo.id} queued for processing`);
  } catch (error) {
     logger.error(`Failed to queue photo ${photo.id} for processing:`, error);
        await prisma.photo.update({
            where: { id: photo.id },
            data: { status: PhotoStatus.FAILED, moderationReason: 'Failed to enter processing queue.' },
        });
  }

  return photo;
}


async function bulkCreatePhotos(journalEntryId: string, userId: string, photos: { url: string; caption?: string; isPublic?: boolean }[]) {
  if (photos.length === 0) {
      throw ApiError.BadRequest('No photo data provided for bulk upload.');
  }

  await _verifyUserPermission(journalEntryId, userId, CollaboratorRole.EDITOR);

  const transactionResult = await prisma.$transaction(async (tx) => {
        const createdPhotos = [];
        for (const photoData of photos) {
            const photo = await tx.photo.create({
                data: {
                    journalEntryId,
                    url: photoData.url,
                    caption: photoData.caption,
                    isPublic: photoData.isPublic ?? false,
                    status: PhotoStatus.PENDING,
                },
            });
            createdPhotos.push(photo);
        }
        return createdPhotos;
    });

  const jobPromises = transactionResult.map(photo =>
      photoQueue.add('process-photo', {
          photoId: photo.id,
          userId,
      }).catch(err => {
          logger.error(`Failed to queue job for photo ${photo.id}`, err);
          // Mark this specific photo as failed if queuing fails.
          return prisma.photo.update({
              where: { id: photo.id },
              data: { status: PhotoStatus.FAILED, moderationReason: 'Failed to enter processing queue.' },
          });
      })
  );

  await Promise.all(jobPromises);
  logger.info(`Bulk processing queued for ${transactionResult.length} photos.`);

  // Return the count of successfully created records.
  return { count: transactionResult.length };
}

  async function getPhotosForJournalEntry(journalEntryId: string, userId: string) {
    
    await _verifyUserPermission(journalEntryId, userId, CollaboratorRole.VIEWER);

    return prisma.photo.findMany({
      where: { journalEntryId,  status: PhotoStatus.APPROVED},
      orderBy: { id: 'asc' },
    });
  }


async function deletePhoto(photoId: string, userId: string) {
    const photo = await prisma.photo.findUnique({
        where: { id: photoId },
        select: { journalEntryId: true, url: true },
    });

    if (!photo) {
        throw ApiError.NotFound('Photo not found.');
    }

    await _verifyUserPermission(photo.journalEntryId, userId, CollaboratorRole.EDITOR);

    await prisma.$transaction([
        // 1. Delete all likes associated with the photo
        prisma.photoLike.deleteMany({ where: { photoId } }),
        // 2. Delete all comments associated with the photo
        prisma.photoComment.deleteMany({ where: { photoId } }),
        // 3. Delete the photo record itself
        prisma.photo.delete({ where: { id: photoId } }),
    ]);
    // 4. Delete the file from storage
    await storageService.deleteFile(photo.url)

    
}

export const photoService = {
  createPhoto,
  bulkCreatePhotos,
  getPhotosForJournalEntry,
  deletePhoto,
};