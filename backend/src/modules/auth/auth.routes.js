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



const router = express.Router();



if (!authController) {
  throw new Error(
    "AuthController not found"
  );
}



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



module.exports = Object.freeze(router);
