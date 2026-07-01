import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { logDir } from "./env";

export const logger = createLogger({
    format: format.combine( format.timestamp({ format: "HH:mm:ss" }), format.colorize(), format.simple(),
        format.printf(info => `${String(info.timestamp)} ${info.level}: ${String(info.message)} `)
    ),
    transports: [
        new transports.Console(),
        new DailyRotateFile({ filename: "aegea.%DATE%.log", dirname: logDir, maxFiles: 15, format: format.uncolorize() }),
        new DailyRotateFile({ filename: "aegea.error.%DATE%.log", dirname: logDir, maxFiles: 15, format: format.uncolorize(), level: "error" })
    ],
});
