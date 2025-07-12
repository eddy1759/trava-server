export const PHOTO_CONFIG = {
    MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
    MAX_FILES_PER_REQUEST: 5,
    ALLOWED_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    MAX_DIMENSIONS: { width: 1920, height: 1080 },
    MIN_DIMENSIONS: { width: 100, height: 100 },
    QUALITY_SETTINGS: {
    jpeg: { quality: 85 },
    png: { compressionLevel: 8 },
    webp: { quality: 85 }
  }
};