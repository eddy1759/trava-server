import {Request, Response, NextFunction} from 'express';
import logger from '../utils/logger';
import CONFIG from '../config/env';
import { ZodError } from 'zod';
import { Prisma } from "@prisma/client";
import ApiError from '../utils/ApiError';
import { StatusCodes } from "http-status-codes";

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): ApiError => {
    switch(error.code){
        case 'P2002':
            return ApiError.Conflict(`Conflict: A record with this value already exists.`);
        case 'P2025':
            return ApiError.NotFound('Record not found');
        default:
            return ApiError.InternalServerError('Database error occurred');
    }
}

const handleZodError = (err: ZodError): ApiError => {
  const errorMessages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
  return ApiError.BadRequest( `Validation Error: ${errorMessages}`);
};

const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  let error: ApiError;

  // Log all errors with full details for debugging
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error('Prisma error:', { code: err.code, message: err.message, meta: err.meta, stack: err.stack });
  } else {
    logger.error('Error:', { message: err.message, stack: err.stack });
  }

  // EDGE CASE: Handle specific, known error types first.
  if (err instanceof ApiError) {
    error = err;
  } else if (err instanceof ZodError) {
    error = handleZodError(err);
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    error = handlePrismaError(err);
  } else {
    // EDGE CASE: Catch all other unexpected errors.
    const message = CONFIG.NODE_ENV === 'production' ? 'An internal server error occurred.' : err.message;
    error = new ApiError(message, StatusCodes.INTERNAL_SERVER_ERROR,  false);
  }

  const { statusCode, message, isOperational } = error;
  
  // Only show stack trace in development
  const response: any = {
    success: false,
    message: error.message,
  };
  if (CONFIG.NODE_ENV !== 'production') {
    response.stack = error.stack;
  }

  res.status(error.statusCode).json(response);

  // Handle non-operational errors (e.g., programming bugs)
  if (!error.isOperational && CONFIG.NODE_ENV !== 'development') {
    logger.error('Non-operational error detected, shutting down...');
    process.exit(1)
  }
};


export default errorHandler;