import multer from 'multer';
import { PHOTO_CONFIG } from './photo.config';
import ApiError from '../../utils/ApiError';
import { Request } from 'express';
import sharp from 'sharp';

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (!PHOTO_CONFIG.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        // Use a standard Error object as expected by multer's callback.
        return cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
};

export const uploadMiddleware = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: PHOTO_CONFIG.MAX_SIZE_BYTES,
    },
});