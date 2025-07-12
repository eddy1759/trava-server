import { Request, Response } from 'express';
import { photoService } from './photo.service';
import { StatusCodes } from 'http-status-codes';
import { asyncWrapper } from '../../utils/asyncWrapper';
import { storageService } from '../../services/storage.service';
import CONFIG from '../../config/env';
import { PHOTO_CONFIG } from './photo.config';
import ApiError from '../../utils/ApiError';

export const handleUploadPhoto = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { journalEntryId, caption, isPublic } = req.body;

    if (!req.file) {
        return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: 'No file uploaded. Please include a file named "image".' });
    }

    const url = await storageService.uploadFile(req.file);

    const photo = await photoService.createPhoto({
        journalEntryId,
        url,
        caption,
        userId,
        isPublic: isPublic === 'true',
    });

    res.status(StatusCodes.CREATED).json({ success: true, message: "Photo uploaded and is being processed.", data: photo });
});

export const handleBulkUpload = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { journalEntryId, isPublic } = req.body;

    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        throw ApiError.BadRequest(`No files uploaded. Please include files named "images" (max ${PHOTO_CONFIG.MAX_FILES_PER_REQUEST}).`);
    }

    const files = req.files as Express.Multer.File[];

    const uploadPromises = files.map(file => storageService.uploadFile(file));
    const urls = await Promise.all(uploadPromises);

    const photosData = urls.map((url, i) => ({
        url,
        caption: req.body.captions?.[i] || undefined,
        isPublic: isPublic === 'true',
    }));

    const result = await photoService.bulkCreatePhotos(journalEntryId, userId, photosData);
    res.status(StatusCodes.CREATED).json({ success: true, message: `${result.count} photos uploaded and are being processed.`, data: result });
});

export const handleGetPhotosForJournalEntry = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { id } = req.params; // Assuming route is /journal/:journalEntryId/photos

    const photos = await photoService.getPhotosForJournalEntry(id, userId);
    res.status(StatusCodes.OK).json({ success: true, data: photos });
});

export const handleDeletePhoto = asyncWrapper(async (req: Request, res: Response) => {
    const userId = req.user.id;
    const { photoId } = req.params;

    await photoService.deletePhoto(photoId, userId);
    res.status(StatusCodes.NO_CONTENT).send();
});