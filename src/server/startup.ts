import app from '../app';
import logger from '../utils/logger';
import CONFIG from '../config/env';
import { amqpWrapper } from '../services/amqpWrapper';
import { redisService } from '../services/redis';
import { emailService } from '../services/email/email.service';
import { dBisConnected, connectToDatabase,  disconnectFromDatabase} from '../services/prisma';
import { setupGracefulShutdown } from './shutdown';
import { createServer } from './serverUtils';
import { startBackgroundJobs } from '../features/jobs/backgroundJob';
import { websocketService } from '../services/websocket.service'; 


export async function startServer(): Promise<void> {
// Return void or the server instance if needed elsewhere
const mainServer = createServer(app, 'Main');

try {
    logger.info('--- Starting Server Initialization ---');
    await redisService.connect();
    await amqpWrapper.initialize();
    await connectToDatabase(); // Throws on failure

    // 3. Start background processes/consumers
    logger.info('Starting background job processors...');
    // Start payroll processor (awaits setup, but runs consumer in background)
    await startBackgroundJobs();
    // Add other processors here if needed
    logger.info('Background job processors setup initiated.');

    // 4. Initialize WebSocket Service
    logger.info('Initializing WebSocket service...');
    websocketService.initialize(mainServer);
    logger.info('WebSocket service initialized successfully.');

    // 5. Start the HTTP Server
    const mainPort = process.env.PORT || CONFIG.PORT; // process.env.PORT takes precedence in production or any environment where it's set

    await new Promise<void>((resolve, reject) => {
        mainServer
            .listen(mainPort, () => {
                // Listening log message is handled by createServer's 'listening' event handler
                resolve();
            })
            .on('error', (error) => {
                // Error handling (EADDRINUSE, EACCES) is handled by createServer's 'error' handler
                // Reject here to propagate other unexpected listen errors
                reject(error);
            });
    });

    logger.info(`Server ready at http://localhost:${mainPort} in ${CONFIG.NODE_ENV} mode`);
    logger.info(`WebSocket endpoint available at ws://localhost:${mainPort}/ws`);

    setupGracefulShutdown([mainServer]);
    logger.info('Graceful shutdown configured.');

    logger.info('--- Server Initialization Complete ---');
} catch (error) {
    logger.error('💥 Server startup failed:', error);
    // Perform any emergency cleanup if necessary (e.g., disconnect already connected services)
    await Promise.allSettled([
        redisService.disconnect(),
        amqpWrapper.close(),
        disconnectFromDatabase(),
    ]);
    process.exit(1); // Exit forcefully on critical startup failure
    // throw error; // Re-throwing might be less desirable than exiting for startup errors
}
}


export async function checkServerReadiness() {
    const checks = [
        { name: 'Database', check: () => dBisConnected() },
        { name: 'Redis', check: () => redisService.ping() },
        { name: 'AMQP', check: () => amqpWrapper.isConnected() },
        { name: 'Email Service', check: () => emailService.healthCheck() },
        { name: 'WebSocket Service', check: () => Promise.resolve(true) } // WebSocket is always ready once initialized
    ];

    const settledResults = await Promise.allSettled(
        checks.map(async(service) => {
            const isReady = await service.check();
            if (!isReady) {
                throw new Error(`${service.name} is not ready`);
            }
            return { name: service.name, status: 'READY' as const };
        })
    );

    const results = settledResults.map((result, index) => {
        const serviceName = checks[index].name;
        if (result.status === 'fulfilled') {
            return { service: serviceName, status: 'READY' as const };
        } else {
            // Log the specific error for better debugging
            logger.warn(`Readiness check failed for ${serviceName}: ${result.reason.message}`);
            return {
                service: serviceName,
                status: 'NOT_READY' as const, // Changed from 'ERROR' to 'NOT_READY' for clarity
                error: result.reason.message, // Access error message from reason
            };
        }
    });

    const overallStatus = results.every((r) => r.status === 'READY') ? 'READY' : 'NOT_READY';

    if (overallStatus !== 'READY') {
        logger.warn('Server readiness check failed for one or more services.', {
            details: results,
        });
    }

    return {
        overall: overallStatus,
        services: results,
    };
}
