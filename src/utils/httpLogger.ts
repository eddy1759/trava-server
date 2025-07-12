import morgan from "morgan";
import { Request, Response } from "express";
import logger from "./logger";
import CONFIG from "../config/env";

const stream = {
    write: (message: string) => logger.http(message.trim())
}

// skip non-error response in production to reduce log volume
const skip = (req: Request, res: Response) => CONFIG.NODE_ENV === "production" && res.statusCode < 400;

const httpLogger = morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"',
    {stream, skip}
)

export default httpLogger;