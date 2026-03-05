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
  USER_ROLES,
} = require("../users/user.constants");
const adminController = require("./admin.controller");
const {
  deleteAdminUserSchema,
} = require("./admin.schema");

const router = express.Router();

router.get(
  "/overview",
  authenticate,
  requireRole(USER_ROLES.ADMIN),
  adminController.getOverview
);

router.get(
  "/users",
  authenticate,
  requireRole(USER_ROLES.ADMIN),
  adminController.getUsers
);

router.get(
  "/users/:userId/predictions",
  authenticate,
  requireRole(USER_ROLES.ADMIN),
  adminController.getUserPredictions
);

router.delete(
  "/users/:userId",
  authenticate,
  requireRole(USER_ROLES.ADMIN),
  validate({ body: deleteAdminUserSchema }),
  adminController.deleteUser
);

module.exports = router;
