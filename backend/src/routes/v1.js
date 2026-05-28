"use strict";

const express = require("express");
const logger = require("../utils/logger");



const router = express.Router();



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




router.use("/auth", authRoutes);


router.use("/users", userRoutes);


router.use("/devices", deviceRoutes);


router.use("/soil", soilRoutes);


router.use("/predictors", predictorRoutes);
router.use("/admin", adminRoutes);
router.use("/chat", chatRoutes);
router.use("/community", communityRoutes);
router.use("/mqtt", mqttRoutes);



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



module.exports = Object.freeze(router);
