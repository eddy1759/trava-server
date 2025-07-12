import { Request} from 'express';
import RedisStore from 'rate-limit-redis';
import rateLimit from 'express-rate-limit';
import { StatusCodes } from 'http-status-codes';
import { redisService } from '../services/redis';
import logger from '../utils/logger';
import ApiError from '../utils/ApiError';
import { create } from 'domain';


const redisClient = redisService.getClient();

const store = new RedisStore({
  sendCommand: (...args: string[]) => redisClient.sendCommand(args),
  prefix: 'rl'
})

const createRateLimiter = (
    windowMs: number, 
    max: number, 
    message: string, 
    keyGenerator?: (req: Request) => string
) => {
    return rateLimit({
        store,
        windowMs,
        max,
        message: {
            status: StatusCodes.TOO_MANY_REQUESTS,
            error: message,
        },
        standardHeaders: true, 
        // Do not send legacy headers
        legacyHeaders: false, 
        // Custom key generator for specific limiters
        keyGenerator: keyGenerator,
        // Handler for when the rate limit is exceeded
        handler: (req, res, next, options) => {
            logger.warn(`Rate limit exceeded for key: ${options.keyGenerator(req, res)} on path: ${req.path}`);
            res.status(options.statusCode).send(options.message);
        },
    });
};


// --- Predefined Rate Limiters ---
// All limiters now use the unified, Redis-backed factory.

// A stricter limiter for authentication attempts to prevent brute-force attacks.
export const authRateLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    10, // 10 auth attempts per 15 minutes per IP
    'Too many authentication attempts from this IP, please try again after 15 minutes.',
    (req) => `auth:${req.ip}` // Key by IP address
);

// A general limiter for most API endpoints.
export const apiRateLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    200, // 200 requests per 15 minutes per IP
    'API rate limit exceeded, please try again later.',
    (req) => {
      const forwarded = req.get('X-Forwarded-For');
      const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
      return `api:${ip}`;
    } // Key by IP address
);

// A global fallback limiter.
export const globalRateLimiter = createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    100, // Limit each IP to 100 requests per 15 minutes
    'Too many requests from this IP, please try again after 15 minutes.'
);

// Specific limiter for commenting. Keys by user ID if logged in, otherwise falls back to IP.
export const commentRateLimiter = createRateLimiter(
    60 * 1000, // 1 minute
    10, // 10 comments per minute
    'Too many comments, please wait before posting again.',
    (req) => `comment:${req.user?.id || req.ip}`
);

// Specific limiter for liking content.
export const likeRateLimiter = createRateLimiter(
    60 * 1000, // 1 minute
    30, // 30 likes per minute
    'Too many likes, please slow down.',
    (req) => `like:${req.user?.id || req.ip}`
);

// Specific limiter for file uploads.
export const uploadRateLimiter = createRateLimiter(
    5 * 60 * 1000, // 5 minutes
    10, // 10 uploads per 5 minutes
    'Too many uploads, please wait before trying again.',
    (req) => `upload:${req.user?.id || req.ip}`
);

// Example of a more complex social interaction limiter.
export const socialRateLimiter = createRateLimiter(
    60 * 1000, // 1 minute
    30, // 30 social interactions per minute
    'Too many social interactions, please slow down.',
    // Here we key by user and the specific action path to be more granular
    (req) => `social:${req.user?.id || req.ip}:${req.path}`
);

export const paymentRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
20, // Allow slightly more requests to avoid penalizing for client-side errors
  'Payment rate limit exceeded',
  (req) => {
    const forwarded = req.get('X-Forwarded-For');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
    return `payment:${ ip }`
  }
);


export const webhookRateLimiter = createRateLimiter(
5 * 60 * 1000, // 5 minutes
500, // A higher limit for Stripe's potential burst of events
'Webhook rate limit exceeded',
(req) => {
    const forwarded = req.get('X-Forwarded-For');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
    return `payment:${ ip }`
  }
);
