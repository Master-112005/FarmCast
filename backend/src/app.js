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



const app = express();

// Hide fingerprint
app.disable("x-powered-by");

// Trust proxy (load balancers)
app.set("trust proxy", 1);



app.use((req, res, next) => {
  const id =
    req.headers["x-correlation-id"] ||
    crypto.randomUUID();

  req.correlationId = id;
  res.setHeader("x-correlation-id", id);

  next();
});



app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

app.use(corsMiddleware);



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



app.use(
  "/uploads",
  express.static(
    path.resolve(process.cwd(), env.UPLOADS.DIR)
  )
);



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



app.get(env.HEALTH_ROUTE || "/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "ok",
    service: "farmcast-backend",
    timestamp: new Date().toISOString(),
  });
});



app.use(
  "/api",
  rateLimitMiddleware,
  apiRoutes
);



app.use(notFoundMiddleware);



app.use(errorMiddleware);



module.exports = Object.freeze(app);
