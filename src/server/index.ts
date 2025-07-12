import { startServer } from './startup';
import logger from '../utils/logger';

process.on('uncaughtException', (error: Error) => {
	logger.error('UNCAUGHT EXCEPTION! Shutting down...', error);
	process.exit(1); // Mandatory exit
});

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
	logger.error('UNHANDLED REJECTION! Shutting down...', { reason, promise });
	process.exit(1); // Mandatory exit
});

startServer();