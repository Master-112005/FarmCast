"use strict";

const cors = require("cors");
const env = require("./env");
const logger = require("../utils/logger");







const allowedOrigins = env.CORS.ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);



const corsOptions = {
  origin: (origin, callback) => {

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

  maxAge: 86400,
};



module.exports = cors(corsOptions);
