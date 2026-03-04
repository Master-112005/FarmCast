/**
 * predictorService.js
 * ------------------------------------------------------
 * Enterprise ML Prediction Service
 * Frontend ↔ Backend ↔ ML Engine
 *
 * CRITICAL FILE:
 * - ML inference gateway
 * - High latency & high cost operations
 * - Must NEVER crash UI
 */

import api from "./api";
import { ENDPOINTS, LIMITS } from "../utils/constants";

/* ======================================================
   SAFE DEFAULTS
====================================================== */

const REQUEST_TIMEOUT =
  LIMITS?.REQUEST_TIMEOUT_MS ?? 15000;

const ML_IMAGE_TIMEOUT =
  LIMITS?.ML_IMAGE_TIMEOUT_MS ?? 30000;

const ALLOWED_IMAGE_TYPES =
  LIMITS?.ALLOWED_IMAGE_TYPES ?? [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

const IMAGE_MAX_MB =
  LIMITS?.IMAGE_MAX_SIZE_MB ?? 5;

/* ======================================================
   INTERNAL: STANDARD RESPONSE SHAPE
====================================================== */

const ok = (data, status) => ({
  success: true,
  data,
  status,
});

const fail = (error) => ({
  success: false,
  error: error?.message || "Prediction request failed",
  status: error?.status,
  code: error?.code,
});

/* ======================================================
   INTERNAL: SAFE EXECUTOR
====================================================== */

const execute = async (requestFn) => {
  try {
    const response = await requestFn();
    return ok(response.data, response.status);
  } catch (error) {
    return fail(error);
  }
};

/* ======================================================
   CORE PREDICTION
====================================================== */

/**
 * Run full ML prediction pipeline
 * Backend resolves user & permissions via JWT
 * @param {Object} payload
 */
export const runPrediction = (payload) => {
  if (!payload) {
    return fail({ message: "Payload required" });
  }

  return execute(() =>
    api.post(
      `${ENDPOINTS.PREDICTORS}/run`,
      payload,
      { timeout: REQUEST_TIMEOUT }
    )
  );
};

/* ======================================================
   RECOMMENDATIONS
====================================================== */

/**
 * Fertilizer recommendation
 * @param {Object} soilPayload
 */
export const getFertilizerRecommendation = (
  soilPayload
) => {
  if (!soilPayload) {
    return fail({ message: "Soil payload required" });
  }

  return execute(() =>
    api.post(
      `${ENDPOINTS.PREDICTORS}/fertilizer`,
      soilPayload,
      { timeout: REQUEST_TIMEOUT }
    )
  );
};

/**
 * Water recommendation
 * @param {Object} waterPayload
 */
export const getWaterRecommendation = (
  waterPayload
) => {
  if (!waterPayload) {
    return fail({ message: "Water payload required" });
  }

  return execute(() =>
    api.post(
      `${ENDPOINTS.PREDICTORS}/water`,
      waterPayload,
      { timeout: REQUEST_TIMEOUT }
    )
  );
};

/* ======================================================
   YIELD & PROFIT
====================================================== */

/**
 * Calculate yield & profit
 * @param {Object} yieldPayload
 */
export const calculateYieldAndProfit = (
  yieldPayload
) => {
  if (!yieldPayload) {
    return fail({ message: "Yield payload required" });
  }

  return execute(() =>
    api.post(
      `${ENDPOINTS.PREDICTORS}/yield`,
      yieldPayload,
      { timeout: REQUEST_TIMEOUT }
    )
  );
};

/* ======================================================
   IMAGE UPLOAD (ML DISEASE PREDICTION)
====================================================== */

/**
 * Upload crop image for disease detection
 * @param {File} file
 */
export const uploadCropImage = (file) => {
  if (!file) {
    return fail({ message: "No file provided" });
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return fail({
      message: "Unsupported image type",
    });
  }

  if (file.size > IMAGE_MAX_MB * 1024 * 1024) {
    return fail({
      message: `File exceeds ${IMAGE_MAX_MB}MB`,
    });
  }

  const formData = new FormData();
  formData.append("file", file);

  return execute(() =>
    api.post(
      `${ENDPOINTS.PREDICTORS}/upload`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: ML_IMAGE_TIMEOUT,
      }
    )
  );
};

/* ======================================================
   EMAIL DELIVERY
====================================================== */

/**
 * Send prediction report to user email (from admin)
 * @param {Object} payload
 */
export const sendPredictionEmail = (payload) => {
  if (!payload?.predictionType) {
    return fail({
      message: "Prediction type required",
    });
  }

  if (!payload?.results) {
    return fail({
      message: "Prediction results required",
    });
  }

  return execute(() =>
    api.post(
      `${ENDPOINTS.PREDICTORS}/mail`,
      payload,
      { timeout: REQUEST_TIMEOUT }
    )
  );
};
