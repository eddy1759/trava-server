import { prisma } from '../../services/prisma';
import ApiError from '../../utils/ApiError';
import { TripLike, TripComment, CollaboratorRole } from '@prisma/client';
import { authorizeTripAccess } from '../../middlewares/auth';
import { CreateCommentData, UpdateCommentData } from './dto/tripSocial.dto';



async function likeTrip(tripId: string, userId: string): Promise<TripLike> {
    // Check if trip is public or user has access
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { collaborators: true }
    });

    if (!trip) throw ApiError.NotFound('Trip not found');

    // Allow likes on public trips or if user has access
    if (!trip.isPublic) {
      await authorizeTripAccess(tripId, userId, [CollaboratorRole.VIEWER]);
    }

    // Check if already liked
    const existingLike = await prisma.tripLike.findUnique({
      where: { tripId_userId: { tripId, userId } }
    });

    if (existingLike) {
      throw ApiError.Conflict('Trip already liked by this user');
    }

    return prisma.tripLike.create({
      data: { tripId, userId }
    });
}


async function unlikeTrip(tripId: string, userId: string): Promise<void> {
    const like = await prisma.tripLike.findUnique({
      where: { tripId_userId: { tripId, userId } }
    });

    if (!like) {
      throw ApiError.NotFound('Like not found');
    }

    await prisma.tripLike.delete({
      where: { tripId_userId: { tripId, userId } }
    });
}

async function getTripLikes(tripId: string, userId?: string): Promise<{
    likes: TripLike[];
    totalCount: number;
    userLiked: boolean;
  }> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { collaborators: true }
    });

    if (!trip) throw ApiError.NotFound('Trip not found');

    // Check access for private trips
    if (!trip.isPublic && userId) {
      await authorizeTripAccess(tripId, userId, [CollaboratorRole.VIEWER]);
    }

    const [likes, totalCount, userLike] = await Promise.all([
      prisma.tripLike.findMany({
        where: { tripId },
        include: { user: { select: { id: true, fullName: true, profilePictureUrl: true } } },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.tripLike.count({ where: { tripId } }),
      userId ? prisma.tripLike.findUnique({
        where: { tripId_userId: { tripId, userId } }
      }) : null
    ]);

    return {
      likes,
      totalCount,
      userLiked: !!userLike
    };
  }

  // Comment functionality
async function createComment(data: CreateCommentData): Promise<TripComment> {
    const { tripId, userId, content } = data;

    // Check if trip is public or user has access
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { collaborators: true }
    });

    if (!trip) throw ApiError.NotFound('Trip not found');

    // Allow comments on public trips or if user has access
    if (!trip.isPublic) {
      await authorizeTripAccess(tripId, userId, [CollaboratorRole.VIEWER]);
    }

    return prisma.tripComment.create({
      data: { tripId, userId, content },
      include: { user: { select: { id: true, fullName: true, profilePictureUrl: true } } }
    });
  }

async function updateComment(commentId: string, userId: string, data: UpdateCommentData): Promise<TripComment> {
    const comment = await prisma.tripComment.findUnique({
      where: { id: commentId },
      include: { trip: true }
    });

    if (!comment) throw ApiError.NotFound('Comment not found');

    // Only comment author can update
    if (comment.userId !== userId) {
      throw ApiError.Forbidden('You can only update your own comments');
    }

    return prisma.tripComment.update({
      where: { id: commentId },
      data,
      include: { user: { select: { id: true, fullName: true, profilePictureUrl: true } } }
    });
  }

async function deleteComment(commentId: string, userId: string): Promise<void> {
    const comment = await prisma.tripComment.findUnique({
      where: { id: commentId },
      include: { trip: true }
    });

    if (!comment) throw ApiError.NotFound('Comment not found');

    // Only comment author or trip owner can delete
    if (comment.userId !== userId && comment.trip.ownerId !== userId) {
      throw ApiError.Forbidden('You can only delete your own comments');
    }

    await prisma.tripComment.delete({
      where: { id: commentId }
    });
  }

async function getTripComments(tripId: string, userId?: string, params: {
    skip?: number;
    take?: number;
  } = {}): Promise<{
    comments: TripComment[];
    totalCount: number;
  }> {
    const { skip = 0, take = 20 } = params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { collaborators: true }
    });

    if (!trip) throw ApiError.NotFound('Trip not found');

    // Check access for private trips
    if (!trip.isPublic && userId) {
      await authorizeTripAccess(tripId, userId, [CollaboratorRole.VIEWER]);
    }

    const [comments, totalCount] = await Promise.all([
      prisma.tripComment.findMany({
        where: { tripId },
        include: { user: { select: { id: true, fullName: true, profilePictureUrl: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.tripComment.count({ where: { tripId } })
    ]);

    return { comments, totalCount };
  }

async function getUserComments(userId: string, params: {
    skip?: number;
    take?: number;
  } = {}): Promise<TripComment[]> {
    const { skip = 0, take = 20 } = params;

    return prisma.tripComment.findMany({
      where: { userId },
      include: { 
        trip: { select: { id: true, tripName: true, isPublic: true } },
        user: { select: { id: true, fullName: true, profilePictureUrl: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take
    });
  }

async function getTripSocialStats(tripId: string, userId?: string): Promise<{
    likesCount: number;
    commentsCount: number;
    userLiked: boolean;
  }> {
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { collaborators: true }
    });

    if (!trip) throw ApiError.NotFound('Trip not found');

    // Check access for private trips
    if (!trip.isPublic && userId) {
      await authorizeTripAccess(tripId, userId, [CollaboratorRole.VIEWER]);
    }

    const [likesCount, commentsCount, userLike] = await Promise.all([
      prisma.tripLike.count({ where: { tripId } }),
      prisma.tripComment.count({ where: { tripId } }),
      userId ? prisma.tripLike.findUnique({
        where: { tripId_userId: { tripId, userId } }
      }) : null
    ]);

    return {
      likesCount,
      commentsCount,
      userLiked: !!userLike
    };
  }

export const tripSocialService = {
  likeTrip,
  unlikeTrip,
  getTripLikes,
  createComment,
  updateComment,
  deleteComment,
  getTripComments,
  getUserComments,
  getTripSocialStats
};