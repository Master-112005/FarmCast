"use strict";

const cors = require("cors");
const env = require("./env");
const logger = require("../utils/logger");



/**
 * Normalize allowed origins.
 * Supports single or comma-separated origins.
 */
const allowedOrigins = env.CORS.ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);



const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn("Blocked CORS origin", { origin });

    return callback(
      new Error("Not allowed by CORS policy"),
      false
    );
  },

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Correlation-ID",
  ],

  exposedHeaders: ["X-Correlation-ID"],

  credentials: env.CORS.CREDENTIALS,

  maxAge: 86400, // Cache preflight response for 24 hours
};



module.exports = cors(corsOptions);
