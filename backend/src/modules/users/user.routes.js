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



const router = express.Router();







router.get(
  "/me",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  userController.getMyProfile
);





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





router.delete(
  "/me",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  userController.deleteMyAccount
);



module.exports = router;
