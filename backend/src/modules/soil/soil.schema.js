/**
 * src/modules/soil/soil.schema.js
 * ------------------------------------------------------
 * Soil Domain Validation Schemas
 *
 * CRITICAL FILE (SOIL DATA INTEGRITY CONTRACT)
 *
 * Responsibilities:
 * - Validate soil telemetry & history queries
 * - Protect analytics from malformed sensor data
 * - Enforce strict, predictable payloads
 *
 * Rules:
 * - NO business logic
 * - NO database access
 * - NO environment variables
 *
 * If this file is wrong → data quality degrades
 */

"use strict";

const Joi = require("joi");

/* ======================================================
   COMMON PARAM SCHEMAS
====================================================== */

/**
 * Device ID parameter
 */
const deviceIdParamSchema = Joi.object({
  deviceId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required()
    .messages({
      "string.guid": "Device ID must be a UUID",
      "any.required": "Device ID is required",
    }),
}).required();

/* ======================================================
   SOIL METRICS
====================================================== */

/**
 * Core soil telemetry metrics
 * (kept strict to preserve analytics quality)
 */
const soilMetrics = {
  moisture: Joi.number()
    .min(0)
    .max(100)
    .required()
    .messages({
      "number.base":
        "Moisture must be a number",
      "number.min":
        "Moisture cannot be negative",
      "number.max":
        "Moisture cannot exceed 100",
    }),

  temperature: Joi.number()
    .min(-20)
    .max(80)
    .required()
    .messages({
      "number.base":
        "Temperature must be a number",
      "number.min":
        "Temperature too low",
      "number.max":
        "Temperature too high",
    }),

  ph: Joi.number()
    .min(0)
    .max(14)
    .optional()
    .messages({
      "number.base": "pH must be a number",
      "number.min":
        "pH cannot be negative",
      "number.max":
        "pH cannot exceed 14",
    }),

  nitrogen: Joi.number()
    .min(0)
    .max(5000)
    .optional()
    .messages({
      "number.base":
        "Nitrogen must be a number",
      "number.min":
        "Nitrogen cannot be negative",
    }),

  phosphorus: Joi.number()
    .min(0)
    .max(5000)
    .optional()
    .messages({
      "number.base":
        "Phosphorus must be a number",
      "number.min":
        "Phosphorus cannot be negative",
    }),

  potassium: Joi.number()
    .min(0)
    .max(5000)
    .optional()
    .messages({
      "number.base":
        "Potassium must be a number",
      "number.min":
        "Potassium cannot be negative",
    }),
};

/* ======================================================
   CREATE SOIL RECORD
====================================================== */

/**
 * POST /api/v1/soil
 *
 * Ownership:
 * - deviceId resolved from route or body
 * - user ownership enforced in service
 */
const createSoilRecordSchema = Joi.object({
  deviceId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required()
    .messages({
      "string.guid": "Device ID must be a UUID",
      "any.required": "Device ID is required",
    }),

  ...soilMetrics,

  gpsValid: Joi.boolean()
    .strict()
    .optional(),

  soilValid: Joi.boolean()
    .strict()
    .optional(),

  latitude: Joi.number()
    .min(-90)
    .max(90)
    .optional(),

  longitude: Joi.number()
    .min(-180)
    .max(180)
    .optional(),

  lat: Joi.number()
    .min(-90)
    .max(90)
    .optional(),

  lng: Joi.number()
    .min(-180)
    .max(180)
    .optional(),

  recordedAt: Joi.date()
    .iso()
    .optional()
    .messages({
      "date.format":
        "recordedAt must be ISO date",
    }),
})
  .custom((value, helpers) => {
    const hasTelemetryFields =
      value.gpsValid !== undefined ||
      value.soilValid !== undefined ||
      value.latitude !== undefined ||
      value.longitude !== undefined ||
      value.lat !== undefined ||
      value.lng !== undefined;

    if (!hasTelemetryFields) {
      return value;
    }

    if (value.gpsValid !== true) {
      return helpers.message(
        "gpsValid must be true for telemetry payloads"
      );
    }

    if (value.soilValid !== true) {
      return helpers.message(
        "soilValid must be true for telemetry payloads"
      );
    }

    const latitude =
      value.latitude !== undefined
        ? value.latitude
        : value.lat;
    const longitude =
      value.longitude !== undefined
        ? value.longitude
        : value.lng;

    if (latitude === undefined || longitude === undefined) {
      return helpers.message(
        "latitude/longitude are required for telemetry payloads"
      );
    }

    if (
      Math.abs(Number(latitude)) < 0.000001 &&
      Math.abs(Number(longitude)) < 0.000001
    ) {
      return helpers.message(
        "0,0 coordinates are not allowed"
      );
    }

    return value;
  })
  .required();

/* ======================================================
   SOIL HISTORY QUERY
====================================================== */

/**
 * GET /api/v1/soil/history
 *
 * Used for charts & analytics
 */
const soilHistoryQuerySchema = Joi.object({
  deviceId: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required()
    .messages({
      "string.guid": "Device ID must be a UUID",
      "any.required": "Device ID is required",
    }),

  from: Joi.date()
    .iso()
    .optional()
    .messages({
      "date.format":
        "from must be ISO date",
    }),

  to: Joi.date()
    .iso()
    .optional()
    .messages({
      "date.format": "to must be ISO date",
    }),

  limit: Joi.number()
    .integer()
    .positive()
    .max(1000)
    .optional()
    .messages({
      "number.max":
        "Limit cannot exceed 1000",
    }),
}).required();

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  deviceIdParamSchema,
  createSoilRecordSchema,
  soilHistoryQuerySchema,
};
