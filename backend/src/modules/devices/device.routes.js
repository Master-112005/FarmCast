"use strict";

const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");

const env = require("../../config/env");
const logger = require("../../utils/logger");
const {
  ERROR_CODES,
} = require("../../utils/constants");

const {
  authenticate,
} = require("../../middlewares/auth.middleware");

const {
  requireRole,
} = require("../../middlewares/rbac.middleware");

const validate =
  require("../../middlewares/validate.middleware");

const deviceController =
  require("./device.controller");
const deviceAuthController =
  require("./device.auth.controller");

const {
  deviceAuthSchema,
} = require("./device.auth.schema");

const {
  createDeviceSchema,
  provisionDeviceSchema,
  updateDeviceSchema,
  deviceIdParamSchema,
  deviceStatusIdentifierParamSchema,
  deviceSyncSchema,
} = require("./device.schema");

const {
  USER_ROLES,
} = require("../users/user.constants");



const router = express.Router();

const deviceAuthLimiter = rateLimit({
  windowMs:
    env.DEVICE_AUTH.RATE_LIMIT_WINDOW_MS,
  max: env.DEVICE_AUTH.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const deviceId = String(
      req.body?.deviceId || ""
    ).trim();

    const deviceFingerprint = deviceId
      ? crypto
          .createHash("sha256")
          .update(deviceId)
          .digest("hex")
          .slice(0, 20)
      : "unknown-device";

    return `${req.ip}:${deviceFingerprint}`;
  },
  handler: (req, res) => {
    logger.warn("Device auth rate limit exceeded", {
      ip: req.ip,
      path: req.originalUrl,
      deviceId:
        typeof req.body?.deviceId === "string"
          ? req.body.deviceId.trim()
          : null,
    });

    res.status(429).json({
      success: false,
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      message:
        "Too many requests. Please slow down and try again.",
      correlationId: req.correlationId,
    });
  },
});



/**
 * POST /api/v1/devices/auth
 * Public (device credentials only)
 */
router.post(
  "/auth",
  deviceAuthLimiter,
  validate({ body: deviceAuthSchema }),
  deviceAuthController.authenticateDevice
);



/**
 * GET /api/v1/devices
 * USER + ADMIN
 */
router.get(
  "/",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  deviceController.getMyDevices
);

/**
 * GET /api/v1/devices/:id
 * USER + ADMIN (ownership enforced in service)
 */
router.get(
  "/:id",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ params: deviceIdParamSchema }),
  deviceController.getMyDeviceById
);

/**
 * GET /api/v1/devices/:id/status
 * USER + ADMIN (ownership enforced in service)
 */
router.get(
  "/:id/status",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({
    params:
      deviceStatusIdentifierParamSchema,
  }),
  deviceController.getDeviceStatus
);

/**
 * POST /api/v1/devices
 * USER + ADMIN
 */
router.post(
  "/",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ body: createDeviceSchema }),
  deviceController.createDevice
);

/**
 * POST /api/v1/devices/provision
 * USER + ADMIN
 */
router.post(
  "/provision",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ body: provisionDeviceSchema }),
  deviceController.provisionDevice
);

/**
 * PUT /api/v1/devices/:id
 * USER + ADMIN (ownership enforced in service)
 */
router.put(
  "/:id",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({
    params: deviceIdParamSchema,
    body: updateDeviceSchema,
  }),
  deviceController.updateMyDevice
);

/**
 * DELETE /api/v1/devices/:id/pre-delete
 * USER + ADMIN (ownership enforced in service)
 */
router.delete(
  "/:id/pre-delete",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ params: deviceIdParamSchema }),
  deviceController.preDeleteDevice
);

/**
 * POST /api/v1/devices/:id/finalize-delete
 * USER + ADMIN (ownership enforced in service)
 */
router.post(
  "/:id/finalize-delete",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ params: deviceIdParamSchema }),
  deviceController.finalizeDeleteDevice
);

/**
 * DELETE /api/v1/devices/:id
 * USER + ADMIN
 * Legacy hard-delete route retained as blocked compatibility endpoint.
 */
router.delete(
  "/:id",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ params: deviceIdParamSchema }),
  deviceController.deleteDevice
);



/**
 * GET /api/v1/devices/:id/live
 * USER + ADMIN
 */
router.get(
  "/:id/live",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ params: deviceIdParamSchema }),
  deviceController.getLiveDeviceData
);

/**
 * PATCH /api/v1/devices/sync/:id
 * USER + ADMIN
 */
router.patch(
  "/sync/:id",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({
    params: deviceIdParamSchema,
    body: deviceSyncSchema,
  }),
  deviceController.syncDeviceData
);



module.exports = router;
