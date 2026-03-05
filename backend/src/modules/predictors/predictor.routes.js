"use strict";

const express = require("express");

const { authenticate } = require("../../middlewares/auth.middleware");
const { requireRole } = require("../../middlewares/rbac.middleware");
const validate = require("../../middlewares/validate.middleware");
const {
  uploadPredictorImage,
} = require("../../middlewares/upload.middleware");

const predictorController = require("./predictor.controller");
const {
  runPredictionSchema,
  recommendationSchema,
  yieldSchema,
  predictionMailSchema,
} = require("./predictor.schema");

const { USER_ROLES } = require("../users/user.constants");

const router = express.Router();



router.post(
  "/run",
  authenticate,
  requireRole(USER_ROLES.USER, USER_ROLES.ADMIN),
  validate({ body: runPredictionSchema }),
  predictorController.runPrediction
);



router.post(
  "/fertilizer",
  authenticate,
  requireRole(USER_ROLES.USER, USER_ROLES.ADMIN),
  validate({ body: recommendationSchema }),
  predictorController.fertilizer
);

router.post(
  "/water",
  authenticate,
  requireRole(USER_ROLES.USER, USER_ROLES.ADMIN),
  validate({ body: recommendationSchema }),
  predictorController.water
);

router.post(
  "/yield",
  authenticate,
  requireRole(USER_ROLES.USER, USER_ROLES.ADMIN),
  validate({ body: yieldSchema }),
  predictorController.yieldEstimation
);



router.post(
  "/upload",
  authenticate,
  requireRole(USER_ROLES.USER, USER_ROLES.ADMIN),
  uploadPredictorImage,
  predictorController.uploadDiseaseImage
);



router.post(
  "/mail",
  authenticate,
  requireRole(USER_ROLES.USER, USER_ROLES.ADMIN),
  validate({ body: predictionMailSchema }),
  predictorController.sendPredictionMail
);

module.exports = router;
