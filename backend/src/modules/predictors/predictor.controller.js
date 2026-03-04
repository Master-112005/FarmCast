/**
 * src/modules/predictors/predictor.controller.js
 * ------------------------------------------------------
 * Predictor Controller
 */

"use strict";

const predictorService = require("./predictor.service");
const response = require("../../utils/response");
const env = require("../../config/env");

/* ======================================================
   RUN FULL PIPELINE
====================================================== */

const runPrediction = async (req, res, next) => {
  try {
    const result =
      await predictorService.runPrediction(req.body, {
        userId: req.user?.id,
      });

    await predictorService.recordPredictionHistory({
      userId: req.user?.id,
      predictionType: "yield",
      input: req.body,
      result,
      requestId: result?.requestId || null,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   RECOMMENDATIONS
====================================================== */

const fertilizer = async (req, res, next) => {
  try {
    const result =
      predictorService.fertilizerRecommendation(
        req.body
      );

    await predictorService.recordPredictionHistory({
      userId: req.user?.id,
      predictionType: "fertilizer",
      input: req.body,
      result,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

const water = async (req, res, next) => {
  try {
    const result =
      predictorService.waterRecommendation(req.body);

    await predictorService.recordPredictionHistory({
      userId: req.user?.id,
      predictionType: "water",
      input: req.body,
      result,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

const yieldEstimation = async (req, res, next) => {
  try {
    const result =
      await predictorService.yieldEstimation(req.body, {
        userId: req.user?.id,
      });

    await predictorService.recordPredictionHistory({
      userId: req.user?.id,
      predictionType: "yield",
      input: req.body,
      result,
      requestId: result?.requestId || null,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   DISEASE IMAGE UPLOAD
====================================================== */

const uploadDiseaseImage = async (req, res, next) => {
  try {
    const file = req.file;
    const prediction =
      await predictorService.diseasePrediction(file);

    const baseUrl = env.APP_BASE_URL.replace(/\/$/, "");
    const imageUrl = `${baseUrl}/uploads/predictors/${file.filename}`;

    const result = {
      ...prediction,
      imageUrl,
    };

    await predictorService.recordPredictionHistory({
      userId: req.user?.id,
      predictionType: "disease",
      input: {
        imageName: file?.originalname || null,
        mimeType: file?.mimetype || null,
        sizeBytes: file?.size || null,
      },
      result,
      requestId: result?.requestId || null,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   PREDICTION MAIL
====================================================== */

const sendPredictionMail = async (req, res, next) => {
  try {
    const result =
      await predictorService.sendPredictionMail(
        req.body,
        {
          user: req.user,
        }
      );
    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  runPrediction,
  fertilizer,
  water,
  yieldEstimation,
  uploadDiseaseImage,
  sendPredictionMail,
};
