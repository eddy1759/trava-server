import { Router } from 'express';
import * as controller from './tripSocial.controller';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validation.middleware';
import { authMiddleware } from '../../middlewares/auth';
import { socialRateLimiter, commentRateLimiter, likeRateLimiter } from '../../middlewares/rateLimit';
import { 
  tripIdParam, 
  commentIdParam,
  createCommentSchema, 
  updateCommentSchema,
  getCommentsSchema,
  getUserCommentsSchema
} from './tripSocial.validation';


const router = Router();


// Public routes (for viewing)
router.get('/:tripId/likes', validateParams(tripIdParam), socialRateLimiter, controller.getTripLikes);
router.get('/:tripId/comments', validateParams(tripIdParam), validateQuery(getCommentsSchema), socialRateLimiter, controller.getTripComments);
router.get('/:tripId/stats', validateParams(tripIdParam), socialRateLimiter, controller.getTripSocialStats);

// Authenticated routes
router.use(authMiddleware);

// Like/Unlike routes with rate limiting
router.post('/:tripId/like', validateParams(tripIdParam), likeRateLimiter, controller.likeTrip);
router.delete('/:tripId/like', validateParams(tripIdParam), likeRateLimiter, controller.unlikeTrip);

// Comment routes with rate limiting
router.post('/:tripId/comments', validateParams(tripIdParam), validateBody(createCommentSchema), commentRateLimiter, controller.createComment);
router.patch('/comments/:commentId', validateParams(commentIdParam), validateBody(updateCommentSchema), commentRateLimiter, controller.updateComment);
router.delete('/comments/:commentId', validateParams(commentIdParam), controller.deleteComment);

// User-specific routes
router.get('/user/comments', validateQuery(getUserCommentsSchema), socialRateLimiter, controller.getUserComments);

export default router; 