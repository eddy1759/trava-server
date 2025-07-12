import { Request, Response, NextFunction } from 'express';
import { photoSocialService } from './photo.social.service';
import ApiError from '../../utils/ApiError'
import { prisma } from '../../services/prisma';
import { UserRole } from '@prisma/client'
import { asyncWrapper } from '../../utils/asyncWrapper';
import { StatusCodes } from 'http-status-codes';
import { PassThrough } from 'stream';


function getPagination(req: Request): { page: number; limit: number } {
    const page = Math.abs(parseInt(req.query.page as string, 10)) || 1;
    const limit = Math.abs(parseInt(req.query.limit as string, 10)) || 20;

    return { page, limit}
}

const likePhotoHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { photoId } =  req.params;
    const userId = req.user?.id;

    const result = await photoSocialService.likePhoto(photoId, userId);

    res.status(StatusCodes.OK).json(result)

})

const unlikePhotoHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { photoId } =  req.params;
    const userId = req.user?.id;

    const result = await photoSocialService.unlikePhoto(photoId, userId)

    res.status(StatusCodes.OK).json(result)
})

const commentOnPhotoHandler = asyncWrapper(async(req: Request, res: Response) => {
    const { photoId } = req.params;
        const { content } = req.body;
        const userId = req.user?.id;

        const comment = await photoSocialService.commentOnPhoto(photoId, userId, content);
        // Return 201 Created for a new resource
        res.status(StatusCodes.CREATED).json(comment);
})

const deleteCommentHandler = asyncWrapper(async (req: Request, res: Response) => {
    const {commentId} = req.params;
    const userId  = req.user?.id;
    const role = req.user?.role;

    const result = await photoSocialService.deleteComment(commentId, {userId, role});

    res.status(StatusCodes.OK).json(result)
});

const getPhotoCommentsHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { photoId } = req.params;
    const pagination = getPagination(req);

    const result = await photoSocialService.getPhotoComments(photoId, pagination)

    res.status(StatusCodes.OK).json(result)
});

const getPhotoLikesHandler = asyncWrapper(async (req: Request, res: Response) => {
    const { photoId } = req.params;
    const pagination = getPagination(req);
        
    const result = await photoSocialService.getPhotoLikes(photoId, pagination);

    res.status(StatusCodes.OK).json(result)
})

export const photoSocialController = {
    likePhotoHandler,
    unlikePhotoHandler,
    commentOnPhotoHandler,
    deleteCommentHandler,
    getPhotoCommentsHandler,
    getPhotoLikesHandler,
};
