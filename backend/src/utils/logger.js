"use strict";

const winston = require("winston");
const env = require("../config/env");



const {
  combine,
  timestamp,
  errors,
  json,
  printf,
  colorize,
} = winston.format;



const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch {
    return "[Unserializable Object]";
  }
};



/**
 * Production format:
 * - JSON
 * - Timestamped
 * - Stack traces for errors
 */
const productionFormat = combine(
  timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  errors({ stack: true }),
  json()
);

/**
 * Development format:
 * - Colorized
 * - Human readable
 * - Includes metadata
 */
const developmentFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, ...meta }) => {
    const metaString =
      Object.keys(meta).length > 0
        ? `\n${safeStringify(meta)}`
        : "";
    return `[${timestamp}] ${level}: ${message}${metaString}`;
  })
);



const transports = [
  new winston.transports.Console({
    level: env.LOGGING.LEVEL,
    handleExceptions: true,
  }),
];



const logger = winston.createLogger({
  level: env.LOGGING.LEVEL,
  format:
    env.NODE_ENV === "production"
      ? productionFormat
      : developmentFormat,
  transports,
  exitOnError: false, // Never crash app due to logging
});



logger.stream = {
  write: (message) => {
    // Remove trailing newline added by stream writers
    logger.info(message.trim());
  },
};



const wrap =
  (level) =>
  (message, meta = {}) => {
    try {
      logger.log(level, message, meta);
    } catch (err) {
      // Logging must NEVER crash the app
      console.error(
        "LOGGER FAILURE:",
        message,
        err?.message
      );
    }
  };



module.exports = {
  info: wrap("info"),
  warn: wrap("warn"),
  error: wrap("error"),
  debug: wrap("debug"),

  // Raw access (use sparingly)
  logger,
};
