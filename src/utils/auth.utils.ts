import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User, UserType, UserRole, Prisma } from "@prisma/client"

import CONFIG from '../config/env';
import logger from './logger';
import ApiError  from './ApiError';
import { redisService }  from "../services/redis"


export const SAFE_USER_SELECT = {
	 id: true,
    email: true,
    fullName: true,
    isVerified: true,
    userType: true,
    userRole: true,
    createdAt: true,
    lastLogin: true,
} as const;

export type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>;

interface BaseTokenPayload extends jwt.JwtPayload {
	purpose: 'access' | 'refresh' | 'email_verification' | 'password_reset';
	jti: string; // Unique identifier for the token
}

interface AccessPayload  extends BaseTokenPayload {
	purpose: 'access';
    id: string;
    isProUser: boolean;
	role: UserRole;
}

interface EmailVerificationTokenPayload extends BaseTokenPayload {
	id: string; // User ID to verify
	purpose: 'email_verification';
}

interface PasswordResetTokenPayload extends BaseTokenPayload {
	id: string; // User ID to reset password
	purpose: 'password_reset'; // Purpose of the token
}

interface RefreshTokenPayload extends BaseTokenPayload {
	id: string;
	purpose: 'refresh'; // Purpose of the token
}

type AnyTokenPayload = AccessPayload | EmailVerificationTokenPayload | PasswordResetTokenPayload | RefreshTokenPayload;


const signToken = (
	payload: object,
	secret: jwt.Secret,
	options: jwt.SignOptions
): string => {
	return jwt.sign(payload, secret, {
		algorithm: 'HS256',
		issuer: CONFIG.JWT_ISSUER,
		audience: CONFIG.JWT_AUDIENCE,
		...options,
	})
}



const verifyToken = <T extends BaseTokenPayload>(
	token: string,
	secret: jwt.Secret,
	expectedPurpose: T['purpose']
) => {
	try {
		const decoded = jwt.verify(token, secret, {
			issuer: CONFIG.JWT_ISSUER,
			audience: CONFIG.JWT_AUDIENCE,
		}) as AnyTokenPayload;

		if (decoded.purpose !== expectedPurpose) {
			throw ApiError.Unauthorized('Invalid token purpose');
		}

		if (typeof decoded.id !== 'string' || typeof decoded.jti !== 'string') {
			throw ApiError.Unauthorized("Invalid token payload structure");
		}

		return decoded;
	} catch (error) {
		if (error instanceof ApiError) throw error;

        // Log the specific JWT error for debugging but return a generic error to the client.
        if (error instanceof jwt.TokenExpiredError) {
            logger.warn(`JWT Verification Failed: Token expired.`, { purpose: expectedPurpose });
            throw ApiError.Unauthorized('Token has expired.');
        }
        if (error instanceof jwt.JsonWebTokenError) {
            logger.warn(`JWT Verification Failed: ${error.message}`, { purpose: expectedPurpose });
            throw ApiError.Unauthorized('Invalid token.');
        }

        logger.error(`An unexpected error occurred during token verification.`, { error });
        throw ApiError.InternalServerError('Failed to process token.')
	}
}


const generateAccessToken = (user: Pick<User, 'id' | 'userRole' | 'userType'>) => {
    const isProUser = !!(user.userType === UserType.PREMIUM);

	const payload: AccessPayload = {
		jti: uuidv4(), // Unique identifier for the token
		id: user.id,
		isProUser,
		role: user.userRole || UserRole.USER, // Default to USER if role is not set
		purpose: "access"
	}

	return signToken(payload, CONFIG.JWT_ACCESS_SECRET, {expiresIn: CONFIG.JWT_EXPIRES_IN});
}

const generateRefreshToken = (user: Pick<User, 'id'>): { token: string; jti: string;  expiryDate: Date } => {
	const jti = uuidv4();
	const payload: RefreshTokenPayload = {
		jti,// Unique identifier for the token
		id: user.id,
		purpose: "refresh"
	};
	const expiresInSeconds = CONFIG.JWT_REFRESH_EXPIRES_IN_SECONDS;
	const token = signToken(payload, CONFIG.JWT_REFRESH_SECRET, { expiresIn: expiresInSeconds });

	const expiryDate = new Date(Date.now() + expiresInSeconds * 1000);
	// redisService.set(`refresh_token:${token}`, { token, expiringDate },  60 * 60); // Store in Redis with 1 hour expiration
	return {
		token,
		jti,
		expiryDate
	}
};

const generateEmailVerificationToken = (user: Pick<User, 'id'>): string => {
	const payload: EmailVerificationTokenPayload = {
		jti: uuidv4(),
		id: user.id,
		purpose: "email_verification"
	};

	return signToken(payload, CONFIG.JWT_VERIFICATION_SECRET, { expiresIn: CONFIG.JWT_VERIFICATION_EXPIRY });
};

const generatePasswordResetToken = (user: Pick<User, 'id'>): string => {
    const payload: PasswordResetTokenPayload = {
        jti: uuidv4(),
        id: user.id,
        purpose: 'password_reset',
    };
    return signToken(payload, CONFIG.JWT_PASSWORD_RESET_SECRET, { expiresIn: CONFIG.JWT_PASSWORD_RESET_EXPIRY });
};

const verifyAccessToken = (token: string) => verifyToken<AccessPayload>(token, CONFIG.JWT_ACCESS_SECRET, 'access');

const verifyRefreshToken = (token: string) => verifyToken<RefreshTokenPayload>(token, CONFIG.JWT_REFRESH_SECRET, 'refresh');

const verifyEmailVerificationToken = (token: string) => verifyToken<EmailVerificationTokenPayload>(token, CONFIG.JWT_VERIFICATION_SECRET, 'email_verification');

const verifyPasswordResetToken = (token: string) => verifyToken<PasswordResetTokenPayload>(token, CONFIG.JWT_PASSWORD_RESET_SECRET, 'password_reset');



const hashPassword = async (password: string): Promise<string> => {
	const salt = await bcrypt.genSalt(CONFIG.SALT_ROUNDS);
	return bcrypt.hash(password, salt);
};

const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
	return bcrypt.compare(password, hashedPassword);
};


const revokeToken = async (jti: string, expirySeconds: number): Promise<void> => {
    const key = `${CONFIG.REVOKED_TOKEN_REDIS_PREFIX}${jti}`;
    // Use 'EX' to set the expiration in seconds atomically.
    await redisService.getClient().set(key, 'revoked', { EX: expirySeconds });
    logger.debug(`Token JTI added to revocation list in Redis`, { jti });
};

const isTokenRevoked = async (jti: string): Promise<boolean> => {
    const key = `${CONFIG.REVOKED_TOKEN_REDIS_PREFIX}${jti}`;
    const result = await redisService.getClient().exists(key);
    return result > 0;
};

export const authUtils = {
	generateAccessToken,
	generateRefreshToken,
	generateEmailVerificationToken,
	generatePasswordResetToken,
	verifyRefreshToken,
	verifyAccessToken,
	verifyEmailVerificationToken,
	verifyPasswordResetToken,
	hashPassword,
	comparePassword,
	revokeToken,
	isTokenRevoked,
};
