/**
 * src/app.js
 * ------------------------------------------------------
 * FarmCast – Enterprise Express Application Core
 *
 * Tier: 0 (Application Kernel)
 *
 * Responsibilities:
 * - Create Express app
 * - Register security, parsing, logging
 * - Mount versioned routes
 * - Expose health endpoint
 * - Attach global error boundaries
 *
 * Rules:
 * - No server.listen()
 * - No DB connections
 * - No business logic
 */

"use strict";

const express = require("express");
const helmet = require("helmet");
const crypto = require("crypto");
const path = require("path");

const env = require("./config/env");
const corsMiddleware = require("./config/cors");
const rateLimitMiddleware = require("./config/rateLimit");

const logger = require("./utils/logger");

const apiRoutes = require("./routes");

const notFoundMiddleware =
  require("./middlewares/notFound.middleware");

const errorMiddleware =
  require("./middlewares/error.middleware");

/* ======================================================
   APP FACTORY
====================================================== */

const app = express();

// Hide fingerprint
app.disable("x-powered-by");

// Trust proxy (load balancers)
app.set("trust proxy", 1);

/* ======================================================
   CORRELATION ID
====================================================== */

app.use((req, res, next) => {
  const id =
    req.headers["x-correlation-id"] ||
    crypto.randomUUID();

  req.correlationId = id;
  res.setHeader("x-correlation-id", id);

  next();
});

/* ======================================================
   SECURITY
====================================================== */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(corsMiddleware);

/* ======================================================
   BODY PARSERS
====================================================== */

app.use(
  express.json({
    limit: "1mb",
    strict: true,
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

/* ======================================================
   STATIC UPLOADS
====================================================== */

app.use(
  "/uploads",
  express.static(
    path.resolve(process.cwd(), env.UPLOADS.DIR)
  )
);

/* ======================================================
   REQUEST LOGGING
====================================================== */

if (env.LOGGING?.HTTP_LOGGING_ENABLED) {
  app.use((req, _res, next) => {
    logger.info("HTTP_REQUEST", {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      correlationId: req.correlationId,
    });
    next();
  });
}

/* ======================================================
   HEALTH CHECK
====================================================== */

app.get(env.HEALTH_ROUTE || "/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "farmcast-backend",
    timestamp: new Date().toISOString(),
  });
});

/* ======================================================
   ROUTES
====================================================== */

app.use(
  "/api",
  rateLimitMiddleware,
  apiRoutes
);

/* ======================================================
   404
====================================================== */

app.use(notFoundMiddleware);

/* ======================================================
   GLOBAL ERROR HANDLER
====================================================== */

app.use(errorMiddleware);

/* ======================================================
   EXPORT
====================================================== */

module.exports = Object.freeze(app);
