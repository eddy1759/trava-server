import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';
import { nanoid } from 'nanoid';
import path from 'path';
import sharp from 'sharp';
import ApiError from '../utils/ApiError';
import CONFIG from '../config/env';
import { PHOTO_CONFIG } from '../features/photo/photo.config';

if (CONFIG.NODE_ENV === 'development') {
    if (!CONFIG.CLOUD_NAME || !CONFIG.CLOUDINARY_API_KEY || !CONFIG.CLOUDINARY_API_SECRET) {
        throw new Error('Cloudinary config missing in development environment');
    }
    cloudinary.config({
        cloud_name: CONFIG.CLOUD_NAME,
        api_key: CONFIG.CLOUDINARY_API_KEY,
        api_secret: CONFIG.CLOUDINARY_API_SECRET,
        secure: true
    });
}

const s3Client = new S3Client({region: CONFIG.AWS_REGION})

async function uploadToS3(file: Express.Multer.File, folder: string): Promise<string> {
    const key = `${folder}/${nanoid()}${path.extname(file.originalname)}`;
    const command = new PutObjectCommand({
        Bucket: CONFIG.AWS_S3_BUCKET!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    });
    
    await s3Client.send(command);
    // It's better to use a CDN or a configured domain name than the raw S3 URL.
    return `https://${CONFIG.AWS_S3_BUCKET}.s3.${CONFIG.AWS_REGION}.amazonaws.com/${key}`;
}

async function uploadToCloudinary(file: Express.Multer.File, folder: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image' },
            (error, result) => {
                if (error || !result) {
                    return reject(ApiError.InternalServerError('Failed to upload image to Cloudinary.'));
                }
                resolve(result.secure_url);
            }
        );
        stream.end(file.buffer);
    });
}

async function uploadFile(file: Express.Multer.File, folder = 'photos'): Promise<string> {
    // Validate image using sharp
    let metadata;
    try {
        metadata = await sharp(file.buffer).metadata();
    } catch {
        throw ApiError.BadRequest('Invalid image format. Could not read metadata.');
    }
    if ((metadata.width && metadata.width > PHOTO_CONFIG.MAX_DIMENSIONS.width) || 
        (metadata.height && metadata.height > PHOTO_CONFIG.MAX_DIMENSIONS.height)) {
        throw ApiError.BadRequest(`Image dimensions must not exceed ${PHOTO_CONFIG.MAX_DIMENSIONS.width}x${PHOTO_CONFIG.MAX_DIMENSIONS.height}.`);
    }
    // Choose storage provider based on environment
    if (CONFIG.NODE_ENV === 'development') {
        return uploadToCloudinary(file, folder);
    } else {
        return uploadToS3(file, folder);
    }
}

async function deleteFile(url: string): Promise<void> {
    if (CONFIG.NODE_ENV === 'development') {
        const publicId = url.split('/').pop()?.split('.')[0];
        if (!publicId) throw ApiError.BadRequest('Invalid Cloudinary URL.');
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    } else {
        // Use DeleteObjectCommand for S3 deletes
        const key = url.split('/').slice(-2).join('/');
        const command = new DeleteObjectCommand({
            Bucket: CONFIG.AWS_S3_BUCKET!,
            Key: key
        });
        await s3Client.send(command);
    }
}

export const storageService = {
    uploadFile,
    deleteFile,
}