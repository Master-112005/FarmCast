"use strict";

const Joi = require("joi");

const deviceIdSchema = Joi.string()
  .trim()
  .pattern(/^fc-[A-Z0-9]{8}$/)
  .required()
  .messages({
    "string.base": "deviceId must be a string",
    "string.empty": "deviceId is required",
    "string.pattern.base":
      "deviceId must match format fc-[A-Z0-9]{8}",
    "any.required": "deviceId is required",
  });

const deviceSecretSchema = Joi.string()
  .min(1)
  .max(256)
  .required()
  .custom((value, helpers) => {
    if (typeof value !== "string") {
      return helpers.error("string.base");
    }

    if (value.trim().length === 0) {
      return helpers.error("string.empty");
    }

    return value;
  })
  .messages({
    "string.base": "deviceSecret must be a string",
    "string.empty": "deviceSecret is required",
    "string.max":
      "deviceSecret must be at most 256 characters",
    "any.required": "deviceSecret is required",
  });

const deviceAuthSchema = Joi.object({
  deviceId: deviceIdSchema,
  deviceSecret: deviceSecretSchema,
}).required();

module.exports = Object.freeze({
  deviceAuthSchema,
});
