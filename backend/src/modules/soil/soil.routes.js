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



const router = express.Router();









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



module.exports = router;
