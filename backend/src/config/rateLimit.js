/**
 * src/config/rateLimit.js
 * ------------------------------------------------------
 * API Rate Limiting Configuration
 *
 * CRITICAL FILE (ABUSE & DOS PROTECTION)
 *
 * Responsibilities:
 * - Protect APIs from brute-force & abuse
 * - Ensure fair usage under load
 * - Never block healthy frontend usage
 * - Fail safely without crashing the server
 *
 * If misconfigured → users get locked out OR app is abused
 */

"use strict";

const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const env = require("./env");
const logger = require("../utils/logger");
const { ERROR_CODES } = require("../utils/constants");

/* ======================================================
   DISABLED MODE (SAFE BYPASS)
====================================================== */

/**
 * Allows turning off rate limiting safely
 * (useful for local dev / controlled demos)
 */
if (!env.SECURITY.RATE_LIMIT_ENABLED) {
  logger.warn("⚠️ Rate limiting is DISABLED");

  module.exports = (_req, _res, next) => next();
  return;
}

/* ======================================================
   RATE LIMIT CONFIGURATION
====================================================== */

const POLLING_ROUTES = Object.freeze([
  /^\/api\/v1\/chat\/contacts$/,
  /^\/api\/v1\/chat\/messages$/,
  /^\/api\/v1\/devices$/,
  /^\/api\/v1\/devices\/[^/]+\/live$/,
  /^\/api\/v1\/admin\/users$/,
  /^\/api\/v1\/admin\/users\/[^/]+\/predictions$/,
]);

const getPathname = (req) =>
  String(req.originalUrl || req.url || "").split("?")[0];

const shouldBypassGlobalRateLimit = (req) => {
  const pathname = getPathname(req);
  return (
    pathname === "/api/v1/mqtt/validate" ||
    pathname === "/api/v1/mqtt/validate."
  );
};

const isPollingRoute = (req) => {
  if (req.method !== "GET") {
    return false;
  }

  const pathname = getPathname(req);
  return POLLING_ROUTES.some((route) =>
    route.test(pathname)
  );
};

const getRateLimitKey = (req) => {
  const authHeader =
    req.headers?.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const tokenFingerprint = token
    ? crypto
        .createHash("sha256")
        .update(token)
        .digest("hex")
        .slice(0, 20)
    : "anon";

  return `${req.ip}:${tokenFingerprint}`;
};

const rateLimitHandler =
  (bucket) => (req, res /*, next */) => {
    logger.warn("Rate limit exceeded", {
      ip: req.ip,
      path: req.originalUrl,
      bucket,
    });

    res.status(429).json({
      success: false,
      code: ERROR_CODES.RATE_LIMITED,
      message:
        "Too many requests. Please slow down and try again.",
    });
  };

const regularLimiter = rateLimit({
  windowMs: env.SECURITY.RATE_LIMIT_WINDOW_MS,
  max: env.SECURITY.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  skip: (req) =>
    shouldBypassGlobalRateLimit(req) ||
    isPollingRoute(req),
  handler: rateLimitHandler("regular"),
});

const pollingLimiter = rateLimit({
  windowMs: env.SECURITY.RATE_LIMIT_WINDOW_MS,
  max: env.SECURITY.RATE_LIMIT_POLLING_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getRateLimitKey,
  skip: (req) =>
    shouldBypassGlobalRateLimit(req) ||
    !isPollingRoute(req),
  handler: rateLimitHandler("polling"),
});

const limiter = (req, res, next) => {
  regularLimiter(req, res, (regularErr) => {
    if (regularErr) {
      next(regularErr);
      return;
    }

    pollingLimiter(req, res, next);
  });
};

/* ======================================================
   EXPORT
====================================================== */

module.exports = limiter;
