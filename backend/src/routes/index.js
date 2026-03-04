/**
 * src/routes/index.js
 * ------------------------------------------------------
 * API Root Router (Enterprise Hardened)
 *
 * CRITICAL FILE (API ENTRY POINT)
 */

"use strict";

const express = require("express");
const env = require("../config/env");
const logger = require("../utils/logger");

const v1Routes = require("./v1");

/* ======================================================
   ROUTER INITIALIZATION
====================================================== */

const router = express.Router();

/* ======================================================
   SAFETY CHECKS
====================================================== */

if (!v1Routes) {
  throw new Error("v1 route module missing");
}

/* ======================================================
   API VERSION ROUTING
====================================================== */

router.use(`/${env.API_VERSION}`, v1Routes);

/* ======================================================
   SAFETY: INVALID API VERSION HANDLER
====================================================== */

router.use((req, res) => {
  logger.warn("Invalid API version access attempt", {
    path: req.originalUrl,
    ip: req.ip,
    correlationId: req.correlationId,
  });

  res.status(404).json({
    success: false,
    status: 404,
    code: "API_VERSION_NOT_SUPPORTED",
    message: "API version not supported",
    correlationId: req.correlationId,
  });
});

/* ======================================================
   EXPORT ROUTER (IMMUTABLE)
====================================================== */

module.exports = Object.freeze(router);
