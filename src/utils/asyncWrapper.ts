import { RequestHandler, Request, Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth";

type AuthenticatedRequestHandler = (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => Promise<any> | any;

export const asyncWrapper = (
    handler: AuthenticatedRequestHandler
): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await handler(req as AuthRequest, res, next);
        } catch (error) {
            next(error);
        }
    };
};