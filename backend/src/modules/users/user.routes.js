/**
 * src/modules/users/user.routes.js
 * ------------------------------------------------------
 * User Routes
 *
 * CRITICAL FILE (USER DOMAIN ACCESS CONTROL)
 *
 * Responsibilities:
 * - Define user endpoints
 * - Enforce authentication and RBAC
 * - Apply request validation
 * - Delegate handling to controllers
 *
 * Rules:
 * - NO business logic
 * - NO database access
 * - NO response shaping
 *
 * If this file is wrong → data isolation breaks
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

const {
  uploadProfileImage,
} = require("../../middlewares/upload.middleware");

const userController =
  require("./user.controller");

const {
  updateMyProfileSchema,
} = require("./user.schema");

const {
  USER_ROLES,
} = require("./user.constants");

/* ======================================================
   ROUTER INITIALIZATION
====================================================== */

const router = express.Router();

/* ======================================================
   USER: SELF PROFILE ROUTES
====================================================== */

/**
 * GET /api/v1/users/me
 * USER + ADMIN
 */
router.get(
  "/me",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  userController.getMyProfile
);

/**
 * PUT /api/v1/users/me
 * USER + ADMIN
 */
router.put(
  "/me",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ body: updateMyProfileSchema }),
  userController.updateMyProfile
);

/**
 * POST /api/v1/users/me/upload
 * USER + ADMIN
 */
router.post(
  "/me/upload",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  uploadProfileImage,
  userController.uploadMyProfileImage
);

/**
 * DELETE /api/v1/users/me
 * USER + ADMIN
 */
router.delete(
  "/me",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  userController.deleteMyAccount
);

/* ======================================================
   EXPORT ROUTER
====================================================== */

module.exports = router;
