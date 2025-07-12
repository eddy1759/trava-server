import { Request, Response, NextFunction, RequestHandler } from 'express';
import { UserRole, UserType, CollaboratorRole } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import logger from '../utils/logger';
import ApiError from '../utils/ApiError';
import { prisma } from '../services/prisma';
import { authUtils } from '../utils/auth.utils';

// Rate limiting for authentication attempts
export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

interface VerifiedJwtPayload {
    id: string;
    isVerified: boolean;
    isProUser: boolean;
    role: UserRole;
    jti?: string; // JWT ID for token revocation
    iat?: number; // Issued at
    exp?: number; // Expiration
}

export interface AuthRequest extends Request {
    user: VerifiedJwtPayload;
}

export interface AuthenticatedUser {
    id: string;
    isVerified: boolean;
    isProUser: boolean;
    role: UserRole;
}

export const authMiddleware: RequestHandler = async (req, res: Response, next: NextFunction) => {
    const authReq = req as AuthRequest;
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(ApiError.Unauthorized('Authentication token is missing or invalid'));
        }
        const token = authHeader.substring(7);
        
        // Validate token format
        if (!token || token.length < 10) {
            return next(ApiError.Unauthorized('Invalid token format'));
        }

        let payload: any;

        try {
            payload = authUtils.verifyAccessToken(token);
            if (!payload || !payload.id) {
                logger.warn('Invalid JWT payload structure', { payload });
                return next(ApiError.Unauthorized('Invalid authentication token'));
            }

            // Enhanced token revocation check
            if (payload.jti) {
                const isRevoked = await authUtils.isTokenRevoked(payload.jti);
                if (isRevoked) {
                    logger.warn('Revoked access token used', { jti: payload.jti, userId: payload.id });
                    return next(ApiError.Unauthorized('Token has been revoked'));
                }
            }

            // Check token age for additional security
            if (payload.iat && Date.now() / 1000 - payload.iat > 24 * 60 * 60) { // 24 hours
                logger.warn('Old token used', { userId: payload.id, tokenAge: Date.now() / 1000 - payload.iat });
            }

        } catch (error) {
            logger.error('JWT verification failed', { error, token: token.substring(0, 10) + '...' });
            return next(ApiError.Unauthorized('Invalid or expired authentication token'));
        }

        // Fetch user from database with enhanced security checks
        const user = await prisma.user.findUnique({
            where: { 
                id: payload.id,
                deleted: false // Ensure user is not deleted
            },
            select: {
                id: true,
                email: true,
                isVerified: true,
                userType: true,
                userRole: true,
                lastLogin: true,
            }
        });

        if (!user) {
            logger.warn('Authentication failed: User not found or deleted', { userId: payload.id });
            return next(ApiError.Unauthorized('User not found'));
        }

        if (!user.isVerified) {
            logger.warn('Authentication failed: User not verified', { userId: payload.id });
            return next(ApiError.Unauthorized('Account not verified'));
        }

        // Update last login time (throttled to avoid excessive DB writes)
        if (!user.lastLogin || Date.now() - user.lastLogin.getTime() > 5 * 60 * 1000) { // 5 minutes
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLogin: new Date() }
            }).catch(err => logger.warn('Failed to update last login', { userId: user.id, error: err.message }));
        }

        const authenticatedUser: AuthenticatedUser = {
            id: user.id,
            isVerified: user.isVerified,
            isProUser: user.userType === UserType.PREMIUM,
            role: user.userRole || UserRole.USER,
        };

        authReq.user = authenticatedUser;
        logger.info('User authenticated successfully', { userId: authReq.user.id, role: authReq.user.role });

        next();
    } catch (error) {
        logger.error('Authentication error', { error, ip: req.ip, userAgent: req.get('User-Agent') });
        if (error instanceof ApiError) {
            return next(error);
        }
        return next(ApiError.InternalServerError('An error occurred during authentication'));
    }
};

export const authorizeUser = (requiredRoles: UserRole[]): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthRequest).user;
        if (!user) {
            return next(ApiError.Unauthorized('User not authenticated'));
        }

        if (!requiredRoles.includes(user.role)) {
            return next(ApiError.Forbidden('User does not have the required role'));
        }

        next();
    };
};

export const adminOnly = authorizeUser([UserRole.ADMIN]);

export const userOrAdminOnly = authorizeUser([UserRole.USER, UserRole.ADMIN]);

export async function authorizeTripAccess(
    tripId: string,
    userId: string,
    requiredRoles: CollaboratorRole[]
): Promise<void> {
    const collaboration = await prisma.tripCollaborator.findUnique({
        where: {
            tripId_userId: {
                tripId,
                userId
            }
        }
    });

    if (!collaboration) throw ApiError.NotFound("Trip not found or you do not have permission to view it.");

    if (!requiredRoles.includes(collaboration.role)) {
        throw ApiError.Forbidden("You do not have permission to access this trip.");
    }
}
