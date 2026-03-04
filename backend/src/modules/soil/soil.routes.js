/**
 * src/modules/soil/soil.routes.js
 * ------------------------------------------------------
 * Soil Routes
 *
 * CRITICAL FILE (SOIL DOMAIN ACCESS CONTROL)
 *
 * Responsibilities:
 * - Define soil telemetry & analytics endpoints
 * - Enforce authentication and RBAC
 * - Apply request validation
 * - Delegate handling to controllers
 *
 * Rules:
 * - NO business logic
 * - NO database access
 * - NO response shaping
 *
 * If this file is wrong → soil data integrity breaks
 */

"use strict";

const express = require("express");

const {
  authenticate,
} = require("../../middlewares/auth.middleware");

const {
  requireRole,
} = require("../../middlewares/rbac.middleware");

const validate =
  require("../../middlewares/validate.middleware");

const soilController =
  require("./soil.controller");

const {
  createSoilRecordSchema,
  soilHistoryQuerySchema,
  deviceIdParamSchema,
} = require("./soil.schema");

const {
  USER_ROLES,
} = require("../users/user.constants");

/* ======================================================
   ROUTER INITIALIZATION
====================================================== */

const router = express.Router();

/* ======================================================
   SOIL TELEMETRY ROUTES
====================================================== */

/**
 * POST /api/v1/soil
 * USER + ADMIN
 *
 * Create a new soil telemetry record
 */
router.post(
  "/",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ body: createSoilRecordSchema }),
  soilController.createSoilRecord
);

/* ======================================================
   SOIL ANALYTICS ROUTES
====================================================== */

/**
 * GET /api/v1/soil/history
 * USER + ADMIN
 *
 * Fetch soil history for charts & analytics
 */
router.get(
  "/history",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ query: soilHistoryQuerySchema }),
  soilController.getSoilHistory
);

/**
 * GET /api/v1/soil/latest/:deviceId
 * USER + ADMIN
 *
 * Fetch latest soil snapshot for dashboard summary
 */
router.get(
  "/latest/:deviceId",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ params: deviceIdParamSchema }),
  soilController.getLatestSoilRecord
);

/* ======================================================
   EXPORT ROUTER
====================================================== */

module.exports = router;
