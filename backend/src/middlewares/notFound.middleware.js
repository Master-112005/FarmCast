/**
 * src/middlewares/notFound.middleware.js
 * ------------------------------------------------------
 * 404 Not Found Handler
 *
 * CRITICAL FILE (API SAFETY & UX CONSISTENCY)
 *
 * Responsibilities:
 * - Catch all unmatched routes
 * - Return a predictable JSON response
 * - Log useful diagnostics without leaking internals
 *
 * Rules:
 * - MUST run after all route mounts
 * - MUST NOT throw
 * - MUST return JSON (never HTML)
 */

"use strict";

const logger = require("../utils/logger");
const {
  ERROR_CODES,
  HTTP_STATUS,
} = require("../utils/constants");

module.exports = (req, res) => {
  // Keep static asset misses quiet (e.g., stale profile image URLs)
  if (req.originalUrl?.startsWith("/uploads/")) {
    return res.status(HTTP_STATUS.NOT_FOUND).end();
  }

  // Log once for observability (no stack traces)
  logger.warn("Route not found", {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    correlationId: req.headers["x-correlation-id"],
  });

  // Send predictable, frontend-safe response
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    message: "API endpoint not found",
    correlationId: req.headers["x-correlation-id"],
  });
};
