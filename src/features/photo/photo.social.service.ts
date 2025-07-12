import { prisma } from "../../services/prisma";
import { PhotoStatus, Prisma, CommentStatus, UserRole } from "@prisma/client";
import ApiError from "../../utils/ApiError";
import logger from "../../utils/logger";
import { storageService } from "../../services/storage.service";
import  { contentModerationQueue } from '../jobs/queue';

interface PaginationOptions {
    page?: number;
    limit?: number;
}

async function likPhoto(photoId: string, userId: string) {
    try {
        await prisma.photoLike.upsert({
            where: { photoId_userId: { photoId, userId}},
            create: { photoId, userId},
            update: {}
        })

        return { success: true, message: "Photo liked." };
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2003') {
                throw ApiError.NotFound('Photo or user not found.');
            }
        }
        logger.error(`Error liking photo ${photoId} for user ${userId}:`, error);
        throw ApiError.InternalServerError('Could not like the photo.');
    }
}

async function unlikePhoto(photoId: string, userId: string) {
    // Use deleteMany to avoid throwing an error if the record doesn't exist.
    // This removes the need for a dangerous silent catch block.
    await prisma.photoLike.deleteMany({
        where: { photoId, userId },
    });
    return { success: true, message: "Photo unliked." };
}

async function commentOnPhoto(photoId: string, userId: string, content: string) {
    const trimmedContent = content?.trim();
    if (!trimmedContent) {
        throw ApiError.BadRequest('Comment content cannot be empty.');
    }

    try {
        const comment = await prisma.$transaction(async (tx) => {
            const newComment = await tx.photoComment.create({
                data: {
                    photoId,
                    userId,
                    content: trimmedContent,
                },
            });

            await contentModerationQueue.add('moderate-comment', {
                contentId: newComment.id,
                userId,
                content: newComment.content,
                reason: 'User comment moderation',
            });

            return newComment;
        });

        return comment;
    } catch (error) {
        logger.error('Failed to create comment or add to moderation queue:', error);
        throw ApiError.InternalServerError('Could not post comment.');
    }
}

async function deleteComment(commentId: string, data: { userId: string, role: UserRole}) {
    const { userId, role } = data;
    const comment = await prisma.photoComment.findUnique({
            where: { id: commentId },
            select: {
                userId: true,
                // TODO: FIX THE NAME FROM hoto TO photo
                hoto: {
                    select: {
                        journalEntry: {
                            select: {
                                userId: true, // The user who owns the journal/photo
                            },
                        },
                    },
                },
            },
        });

        if (!comment) {
            throw ApiError.NotFound('Comment not found.');
        }

    const isCommentOwner = comment.userId === userId;
    const isPhotoOwner = comment.hoto.journalEntry.userId === userId;
    const isAdmin = role === UserRole.ADMIN;

    if (!isCommentOwner && !isPhotoOwner && !isAdmin) {
        throw ApiError.Forbidden('You do not have permission to delete this comment.');
    }

    await prisma.photoComment.delete({
        where: { id: commentId },
    });

    return { success: true, message: "Comment deleted." };
}

async function getPhotoComments(photoId: string, options: PaginationOptions = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [comments, total] = await prisma.$transaction([
        prisma.photoComment.findMany({
            where: {
                photoId,
                // CRITICAL: Only show approved comments to users.
                status: CommentStatus.APPROVED,
            },
            orderBy: { createdAt: 'asc' },
            take: limit,
            skip: skip,
            include: {
                user: {
                    select: { id: true, fullName: true, profilePictureUrl: true },
                },
            },
        }),
        prisma.photoComment.count({
            where: { photoId, status: CommentStatus.APPROVED },
        }),
    ]);

    return {
        data: comments,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

async function getPhotoLikes(photoId: string, options: PaginationOptions = {}) {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const [likes, total] = await prisma.$transaction([
        prisma.photoLike.findMany({
            where: { photoId },
            take: limit,
            skip: skip,
            include: {
                user: {
                    select: { id: true, fullName: true, profilePictureUrl: true },
                },
            },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.photoLike.count({ where: { photoId } })
    ]);

    return {
        data: likes,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }
    };
}

export const photoSocialService = {
    likePhoto: likPhoto,
    unlikePhoto,
    commentOnPhoto,
    deleteComment,
    getPhotoComments,
    getPhotoLikes,
};


