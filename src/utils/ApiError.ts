import { StatusCodes } from "http-status-codes";

class ApiError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        // Maintain proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);
    }

    static BadRequest = (message: string) => new ApiError(message, StatusCodes.BAD_REQUEST);
    static Unauthorized = (message: string) => new ApiError(message, StatusCodes.UNAUTHORIZED);
    static Forbidden = (message: string) => new ApiError(message, StatusCodes.FORBIDDEN);
    static NotFound = (message: string) => new ApiError(message, StatusCodes.NOT_FOUND);
    static Conflict = (message: string) => new ApiError(message, StatusCodes.CONFLICT);
    static TooManyRequest = (message: string) => new ApiError(message, StatusCodes.TOO_MANY_REQUESTS)
    static InternalServerError = (message: string) => new ApiError(message, StatusCodes.INTERNAL_SERVER_ERROR, false);
    static ServiceUnavailable = (message: string) => new ApiError(message, StatusCodes.SERVICE_UNAVAILABLE);  
}

export default ApiError;
