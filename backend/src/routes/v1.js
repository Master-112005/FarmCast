/**
 * src/routes/v1.js
 * ------------------------------------------------------
 * API v1 Router (Enterprise Hardened)
 *
 * CRITICAL FILE (PUBLIC API SURFACE)
 */

"use strict";

const express = require("express");
const logger = require("../utils/logger");

/* ======================================================
   ROUTER INITIALIZATION
====================================================== */

const router = express.Router();

/* ======================================================
   LOAD DOMAIN ROUTES (FAIL FAST)
====================================================== */

const authRoutes = require("../modules/auth/auth.routes");
const userRoutes = require("../modules/users/user.routes");
const deviceRoutes = require("../modules/devices/device.routes");
const soilRoutes = require("../modules/soil/soil.routes");
const predictorRoutes =
  require("../modules/predictors/predictor.routes");
const adminRoutes =
  require("../modules/admin/admin.routes");
const chatRoutes = require("../modules/chat/chat.routes");
const communityRoutes =
  require("../modules/community/community.routes");
const mqttRoutes = require("../modules/mqtt/mqtt.routes");

if (
  !authRoutes ||
  !userRoutes ||
  !deviceRoutes ||
  !soilRoutes ||
  !predictorRoutes ||
  !adminRoutes ||
  !chatRoutes ||
  !communityRoutes ||
  !mqttRoutes
) {
  throw new Error("One or more v1 route modules missing");
}

/* ======================================================
   ROUTE MOUNTING
====================================================== */

// 🔐 Authentication
router.use("/auth", authRoutes);

// 👤 Users / Profile
router.use("/users", userRoutes);

// 📡 Devices & IoT
router.use("/devices", deviceRoutes);

// 🌱 Soil Data
router.use("/soil", soilRoutes);

// 🤖 Predictors
router.use("/predictors", predictorRoutes);
router.use("/admin", adminRoutes);
router.use("/chat", chatRoutes);
router.use("/community", communityRoutes);
router.use("/mqtt", mqttRoutes);

/* ======================================================
   SAFETY: UNMATCHED v1 ROUTES
====================================================== */

router.use((req, res) => {
  logger.warn("Unmatched v1 API route", {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    correlationId: req.correlationId,
  });

  res.status(404).json({
    success: false,
    status: 404,
    code: "RESOURCE_NOT_FOUND",
    message: "API endpoint not found",
    correlationId: req.correlationId,
  });
});

/* ======================================================
   EXPORT ROUTER (IMMUTABLE)
====================================================== */

module.exports = Object.freeze(router);
