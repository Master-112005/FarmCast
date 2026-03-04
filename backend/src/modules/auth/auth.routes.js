/**
 * src/modules/auth/auth.routes.js
 * ------------------------------------------------------
 * Authentication Routes (Enterprise Hardened)
 *
 * CRITICAL FILE (PUBLIC AUTH ENTRY POINT)
 *
 * Responsibilities:
 * - Define authentication endpoints
 * - Apply request validation
 * - Delegate handling to controllers
 *
 * Rules:
 * - NO business logic
 * - NO database access
 * - NO token handling here
 */

"use strict";

const express = require("express");

const validate =
  require("../../middlewares/validate.middleware");

const authController =
  require("./auth.controller");

const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require("./auth.schema");

/* ======================================================
   ROUTER INITIALIZATION
====================================================== */

const router = express.Router();

/* ======================================================
   SAFETY CHECKS
====================================================== */

if (!authController) {
  throw new Error(
    "AuthController not found"
  );
}

/* ======================================================
   AUTH ROUTES (PUBLIC)
====================================================== */

/**
 * POST /api/v1/auth/register
 */
router.post(
  "/register",
  validate({ body: registerSchema }),
  authController.register
);

/**
 * POST /api/v1/auth/login
 */
router.post(
  "/login",
  validate({ body: loginSchema }),
  authController.login
);

/**
 * POST /api/v1/auth/refresh
 */
router.post(
  "/refresh",
  validate({ body: refreshSchema }),
  authController.refresh
);

/**
 * POST /api/v1/auth/logout
 *
 * Logout via refresh token only
 */
router.post(
  "/logout",
  validate({ body: refreshSchema }),
  authController.logout
);

/* ======================================================
   EXPORT ROUTER (IMMUTABLE)
====================================================== */

module.exports = Object.freeze(router);
