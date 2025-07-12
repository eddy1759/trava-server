import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { tripSocialService } from './tripSocial.service';
import { 
  tripIdParam, 
  commentIdParam,
  createCommentSchema, 
  updateCommentSchema,
  getCommentsSchema,
  getUserCommentsSchema
} from './tripSocial.validation';
import { asyncWrapper } from '../../utils/asyncWrapper';


export const likeTrip = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = tripIdParam.parse(req.params);
  const userId = req.user?.id;
  if (!userId) throw new Error('User not authenticated');

  const like = await tripSocialService.likeTrip(tripId, userId);
  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Trip liked successfully',
    data: like
  });
});

export const unlikeTrip = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = tripIdParam.parse(req.params);
  const userId = req.user?.id;
  if (!userId) throw new Error('User not authenticated');

  await tripSocialService.unlikeTrip(tripId, userId);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Trip unliked successfully'
  });
});

export const getTripLikes = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = tripIdParam.parse(req.params);
  const userId = req.user?.id;

  const result = await tripSocialService.getTripLikes(tripId, userId);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Trip likes retrieved successfully',
    data: result
  });
});

// Comment functionality
export const createComment = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = tripIdParam.parse(req.params);
  const userId = req.user?.id;
  if (!userId) throw new Error('User not authenticated');

  const data = createCommentSchema.parse(req.body);
  const comment = await tripSocialService.createComment({
    tripId,
    userId,
    content: data.content
  });
  res.status(StatusCodes.CREATED).json({
    success: true,
    message: 'Comment created successfully',
    data: comment
  });
});

export const updateComment = asyncWrapper(async (req: Request, res: Response) => {
  const { commentId } = commentIdParam.parse(req.params);
  const userId = req.user?.id;
  if (!userId) throw new Error('User not authenticated');

  const data = updateCommentSchema.parse(req.body);
  const comment = await tripSocialService.updateComment(commentId, userId, data);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Comment updated successfully',
    data: comment
  });
});

export const deleteComment = asyncWrapper(async (req: Request, res: Response) => {
  const { commentId } = commentIdParam.parse(req.params);
  const userId = req.user?.id;
  if (!userId) throw new Error('User not authenticated');

  await tripSocialService.deleteComment(commentId, userId);
  res.status(StatusCodes.NO_CONTENT).send();
});

export const getTripComments = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = tripIdParam.parse(req.params);
  const userId = req.user?.id;
  const query = getCommentsSchema.parse(req.query);

  const result = await tripSocialService.getTripComments(tripId, userId, query.query);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Trip comments retrieved successfully',
    data: result
  });
});

export const getUserComments = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw new Error('User not authenticated');

  const query = getUserCommentsSchema.parse(req.query);
  const comments = await tripSocialService.getUserComments(userId, query.query);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'User comments retrieved successfully',
    data: comments
  });
});

export const getTripSocialStats = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = tripIdParam.parse(req.params);
  const userId = req.user?.id;

  const stats = await tripSocialService.getTripSocialStats(tripId, userId);
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Trip social stats retrieved successfully',
    data: stats
  });
}); 