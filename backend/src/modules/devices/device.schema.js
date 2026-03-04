/**
 * src/modules/devices/device.schema.js
 * ------------------------------------------------------
 * Device Domain Validation Schemas
 *
 * CRITICAL FILE (DEVICE INPUT CONTRACT)
 *
 * Responsibilities:
 * - Validate device-related request payloads
 * - Protect device lifecycle endpoints from invalid input
 * - Prevent ownership & configuration abuse
 *
 * Rules:
 * - NO business logic
 * - NO database access
 * - NO environment variables
 *
 * If this file is wrong → device integrity breaks
 */

"use strict";

const Joi = require("joi");
const {
  DEVICE_TYPES,
  DEVICE_STATUS,
  DEVICE_LIMITS,
} = require("./device.constants");

/* ======================================================
   COMMON FIELD SCHEMAS
====================================================== */

const deviceName = Joi.string()
  .min(DEVICE_LIMITS.MIN_NAME_LENGTH)
  .max(DEVICE_LIMITS.MAX_NAME_LENGTH)
  .trim()
  .messages({
    "string.min": `Device name must be at least ${DEVICE_LIMITS.MIN_NAME_LENGTH} characters`,
    "string.max": `Device name must be at most ${DEVICE_LIMITS.MAX_NAME_LENGTH} characters`,
  });

const deviceType = Joi.string()
  .valid(...Object.values(DEVICE_TYPES))
  .messages({
    "any.only": "Invalid device type",
  });

const deviceStatus = Joi.string()
  .valid(...Object.values(DEVICE_STATUS))
  .messages({
    "any.only": "Invalid device status",
  });

const cropId = Joi.string()
  .guid({ version: ["uuidv4", "uuidv5"] })
  .allow(null)
  .messages({
    "string.guid": "cropId must be a UUID",
  });

const moistureThreshold = Joi.number()
  .min(0)
  .max(100)
  .allow(null)
  .messages({
    "number.base": "Moisture threshold must be a number",
    "number.min":
      "Moisture threshold cannot be below 0",
    "number.max":
      "Moisture threshold cannot exceed 100",
  });

const wifiSsid = Joi.string()
  .trim()
  .max(64)
  .messages({
    "string.base": "WiFi SSID must be a string",
    "string.max":
      "WiFi SSID must be at most 64 characters",
  });

const wifiPassword = Joi.string()
  .max(64)
  .messages({
    "string.base": "WiFi password must be a string",
    "string.max":
      "WiFi password must be at most 64 characters",
  });

const soilTelemetrySchema = Joi.object({
  moisture: Joi.number().min(0).max(100).required(),
  temperature: Joi.number().min(-20).max(80).required(),
  ph: Joi.number().min(0).max(14).required(),
  nitrogen: Joi.number().min(0).max(5000).required(),
  phosphorus: Joi.number().min(0).max(5000).required(),
  potassium: Joi.number().min(0).max(5000).required(),
  recordedAt: Joi.date().iso().optional(),
}).required();

/* ======================================================
   REGISTER DEVICE (USER)
====================================================== */

/**
 * POST /api/v1/devices
 *
 * USER can provide:
 * - name
 * - type
 *
 * Explicitly disallowed:
 * - status (system-managed)
 * - userId (derived from JWT)
 */
const createDeviceSchema = Joi.object({
  name: deviceName.required(),
  type: deviceType.required(),
  cropId: cropId.optional(),
  moistureMinThreshold:
    moistureThreshold.optional(),
  moistureMaxThreshold:
    moistureThreshold.optional(),
})
  .custom((value, helpers) => {
    const min = value.moistureMinThreshold;
    const max = value.moistureMaxThreshold;

    if (
      min != null &&
      max != null &&
      Number(min) > Number(max)
    ) {
      return helpers.error("any.invalid");
    }

    return value;
  })
  .messages({
    "any.invalid":
      "moistureMinThreshold cannot be greater than moistureMaxThreshold",
}).required();

/* ======================================================
   PROVISION DEVICE (CLAIM FLOW)
====================================================== */

const provisionDeviceSchema = Joi.object({
  deviceName: deviceName.required(),
}).required();

/* ======================================================
   UPDATE DEVICE (OWNER / ADMIN)
====================================================== */

/**
 * PUT /api/v1/devices/:id
 *
 * Allowed updates:
 * - name
 * - status (ADMIN only, enforced by RBAC)
 * - wifiSsid + wifiPassword (paired, ephemeral update command)
 */
const updateDeviceSchema = Joi.object({
  name: deviceName,
  status: deviceStatus,
  cropId,
  moistureMinThreshold: moistureThreshold,
  moistureMaxThreshold: moistureThreshold,
  wifiSsid,
  wifiPassword,
})
  .custom((value, helpers) => {
    const min = value.moistureMinThreshold;
    const max = value.moistureMaxThreshold;
    const ssid = String(value.wifiSsid || "").trim();
    const password = String(value.wifiPassword || "");
    const wifiProvided =
      ssid.length > 0 || password.length > 0;

    if (
      min != null &&
      max != null &&
      Number(min) > Number(max)
    ) {
      return helpers.error("any.invalid");
    }

    if (
      wifiProvided &&
      (ssid.length === 0 || password.length === 0)
    ) {
      return helpers.error("any.wifiPair");
    }

    if (wifiProvided && password.length < 8) {
      return helpers.error("any.wifiPasswordMin");
    }

    return value;
  })
  .min(1)
  .required()
  .messages({
    "object.min":
      "At least one device field must be provided",
    "any.invalid":
      "moistureMinThreshold cannot be greater than moistureMaxThreshold",
    "any.wifiPair":
      "Both wifiSsid and wifiPassword are required to update WiFi credentials",
    "any.wifiPasswordMin":
      "WiFi password must be at least 8 characters",
  });

/* ======================================================
   DEVICE PARAMS
====================================================== */

/**
 * Common device ID param validation
 */
const deviceIdParamSchema = Joi.object({
  id: Joi.string()
    .guid({ version: ["uuidv4", "uuidv5"] })
    .required()
    .messages({
      "string.guid": "Device ID must be a UUID",
      "any.required": "Device ID is required",
    }),
}).required();

const deviceStatusIdentifierParamSchema = Joi.object({
  id: Joi.alternatives()
    .try(
      Joi.string().guid({
        version: ["uuidv4", "uuidv5"],
      }),
      Joi.string()
        .trim()
        .pattern(/^fc-[A-Z0-9]{8}$/)
    )
    .required()
    .messages({
      "alternatives.match":
        "Device identifier must be a UUID or fc-[A-Z0-9]{8}",
      "any.required": "Device identifier is required",
    }),
}).required();

/* ======================================================
   IOT SYNC PAYLOAD (FUTURE-READY)
====================================================== */

/**
 * PATCH /api/v1/devices/sync/:id
 *
 * Generic sensor payload
 * (validated loosely; domain logic handles content)
 */
const deviceSyncSchema = Joi.object({
  data: soilTelemetrySchema.messages({
    "any.required":
      "Device data payload is required",
  }),
}).required();

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  createDeviceSchema,
  provisionDeviceSchema,
  updateDeviceSchema,
  deviceIdParamSchema,
  deviceStatusIdentifierParamSchema,
  deviceSyncSchema,
};
