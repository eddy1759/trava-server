import * as winston from "winston";
import "winston-daily-rotate-file"
import CONFIG from "../config/env"


const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
}

const colours = {
    error: "red",
    warn: "yellow",
    info: "green",
    http: "magenta",
    debug: 'white',
}

winston.addColors(colours);

const format = winston.format.combine(
    winston.format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss" }),
        winston.format.splat(),
        CONFIG.NODE_ENV === "production" ? winston.format.json() : winston.format.colorize({ all: true }),
        winston.format.printf(
            (info) => `[${info.timestamp}] ${info.level}: ${info.message}` 
        )
);

const transports: winston.transport[] = [
    new winston.transports.Console(),
];

if (CONFIG.NODE_ENV === "production") {
    transports.push(
        new winston.transports.DailyRotateFile({
            filename: "logs/application-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "14d"
        }),
        new winston.transports.DailyRotateFile({
            filename: "logs/error-%DATE%.log",
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "14d",
            level: "error"
        })
    );
}

const logger = winston.createLogger({
    level: CONFIG.NODE_ENV === "development" ? "debug" : "info",
    levels,
    format,
    transports,
    exitOnError: false,
    handleExceptions: true,
    handleRejections: true,
});

export default logger;