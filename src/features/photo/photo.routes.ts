import { Router } from 'express';
import * as photoController from './photo.controller';
import { photoSocialController } from './photo.social.controller';
import { validateBody } from '../../middlewares/validation.middleware';
import { createPhotoSchema, commentSchema, bulkUploadPhotoSchema } from './photo.validation';
import { authMiddleware } from '../../middlewares/auth';
import { uploadRateLimiter, likeRateLimiter, commentRateLimiter } from '../../middlewares/rateLimit';
import { uploadMiddleware } from './photo.upload';

const router = Router();

router.use(authMiddleware);

// 


router.post('/upload', uploadRateLimiter,  uploadMiddleware.single('image'), validateBody(createPhotoSchema),photoController.handleUploadPhoto);
router.post('/bulk-upload', uploadRateLimiter, uploadMiddleware.array('images', 5), photoController.handleBulkUpload);
router.delete('/:photoId', photoController.handleDeletePhoto);


// Social endpoints with rate limiting
router.post('/:photoId/like', likeRateLimiter, photoSocialController.likePhotoHandler);
router.post('/:photoId/unlike', likeRateLimiter, photoSocialController.unlikePhotoHandler);
router.post('/:photoId/comment', validateBody(commentSchema), commentRateLimiter, photoSocialController.commentOnPhotoHandler);
router.get('/:photoId/comments', photoSocialController.getPhotoCommentsHandler);
router.get('/:photoId/likes', photoSocialController.getPhotoLikesHandler);

export default router;