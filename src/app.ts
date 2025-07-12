import express, { Request, Response, NextFunction, Application, ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import compression from 'compression';


import httpLogger from './utils/httpLogger';
import { globalRateLimiter, apiRateLimiter, authRateLimiter } from './middlewares/rateLimit';
import { readRawBody } from './features/payment/payment.middleware'
import apiRouter from './routes';
import ApiError from './utils/ApiError';
import logger from "./utils/logger"
import { checkServerReadiness } from './server/startup';
import CONFIG from './config/env';

const app: Application = express();

app.use(httpLogger);

app.use(readRawBody)

// Enhanced security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", `http://localhost:${CONFIG.PORT}`],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Enhanced CORS configuration
const allowedOrigins = [
    CONFIG.FRONTEND_URL,
    'https://trava-app.vercel.app',
    'https://trava-app.netlify.app'
].filter(Boolean); // Filter out any undefined/empty URLs

// In development, we allow requests from standard local development servers.
if (CONFIG.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000', 'http://localhost:3001');
}

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (e.g., server-to-server, mobile apps, curl)
        // and requests from our dynamic list of allowed origins.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from invalid origin: ${origin}`);
            callback(new Error('This origin is not allowed by CORS.'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));

// Enhanced HPP protection
app.use(hpp({
    whitelist: ['embedding', 'location', 'coordinates'] // Allow specific parameters
}));


// Global rate limiting
app.use(globalRateLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
    extended: true,
    limit: '10mb',
    parameterLimit: 1000
}));

app.use(compression({
    level: 6, // A good balance between compression ratio and speed.
    threshold: 1024, // Only compress responses over 1KB.
    filter: (req, res) => {
        // Don't compress if the client has sent this header.
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));


// --- Public & Utility Routes ---

// Health check endpoint with enhanced security
app.get('/healthz', async (req, res) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store',
    });
    
    try {
        const timestamp = new Date().toISOString();
        const readiness = await checkServerReadiness();
        const statusCode = readiness.overall === 'READY' ? 200 : 503;
        
        res.status(statusCode).json({
            status: readiness.overall,
            timestamp,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            services: readiness.services,
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'ERROR',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(`
        # HELP http_requests_total Total number of HTTP requests
        # TYPE http_requests_total counter
        http_requests_total{method="GET",status="200"} 0
        http_requests_total{method="POST",status="200"} 0
        http_requests_total{method="PUT",status="200"} 0
        http_requests_total{method="DELETE",status="200"} 0

        # HELP http_request_duration_seconds Duration of HTTP requests
        # TYPE http_request_duration_seconds histogram
        http_request_duration_seconds_bucket{le="0.1"} 0
        http_request_duration_seconds_bucket{le="0.5"} 0
        http_request_duration_seconds_bucket{le="1"} 0
        http_request_duration_seconds_bucket{le="+Inf"} 0
        http_request_duration_seconds_sum 0
        http_request_duration_seconds_count 0
    `);
});

app.get('/', (req: Request, res: Response) => {
    res.status(200).json({ 
        message: 'Welcome to the Trava API',
        version: process.env.npm_package_version || '1.0.0',
        environment: CONFIG.NODE_ENV,
        timestamp: new Date().toISOString()
    });
});

// --- API Routing ---
app.use('/api/v1/auth', authRateLimiter, apiRouter); // Stricter rate limit for auth routes.
app.use('/api/v1', apiRateLimiter, apiRouter);


// // Enhanced error handling
// app.use(errorHandler);

// Single 404 handler with better logging
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.warn('404 Not Found:', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });
    next(ApiError.NotFound(`Route not found: ${req.method} ${req.originalUrl}`));
});

// Global error handler with enhanced logging
app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
    const status = err.status || 500;
    
    // In production, we don't want to leak implementation details.
    const message = (status >= 500 && CONFIG.NODE_ENV === 'production')
        ? 'An unexpected internal server error occurred.'
        : err.message;

    
    const errorDetails = {
        message: err.message,
        stack: CONFIG.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
    };

    // Log error with appropriate level
    if (err.status >= 500) {
        logger.error('Server error:', errorDetails);
    } else {
        logger.warn('Client error:', errorDetails);
    }


    res.status(status).json({
        error: message,
        status,
        timestamp: new Date().toISOString()
    });
} as ErrorRequestHandler);

// Enhanced unhandled rejection and exception handlers
process.on('unhandledRejection', (reason: Error | any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString()
    });
    
    // In production, exit gracefully
    if (CONFIG.NODE_ENV === 'production') {
        process.exit(1);
    }
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception thrown:', {
        message: error.message,
        stack: error.stack
    });
    
    // In production, exit gracefully
    if (CONFIG.NODE_ENV === 'production') {
        process.exit(1);
    }
});

export default app;