/**
 * src/modules/mqtt/mqtt.schema.js
 * ------------------------------------------------------
 * MQTT Auth Validation Schema
 *
 * Responsibilities:
 * - Validate Mosquitto auth callback payloads
 * - Keep endpoint contract strict and safe
 */

"use strict";

const Joi = require("joi");

const usernameSchema = Joi.string()
  .trim()
  .min(1)
  .max(128)
  .messages({
    "string.base": "username must be a string",
    "string.empty": "username is required",
    "string.max":
      "username must be at most 128 characters",
  });

const passwordSchema = Joi.string()
  .max(4096)
  .optional()
  .messages({
    "string.base": "password must be a string",
    "string.max":
      "password must be at most 4096 characters",
  });

const clientIdSchema = Joi.string()
  .trim()
  .max(256)
  .optional()
  .allow("")
  .messages({
    "string.base": "clientid must be a string",
    "string.max":
      "clientid must be at most 256 characters",
  });

const topicSchema = Joi.string()
  .trim()
  .max(512)
  .optional()
  .messages({
    "string.base": "topic must be a string",
    "string.max":
      "topic must be at most 512 characters",
  });

const accessSchema = Joi.alternatives()
  .try(
    Joi.number().integer().min(1).max(4),
    Joi.string().trim().pattern(/^[1-4]$/)
  )
  .optional()
  .messages({
    "alternatives.match":
      "acc must be one of 1, 2, 3, or 4",
  });

const mqttValidateSchema = Joi.object({
  username: usernameSchema.optional(),
  user: usernameSchema.optional(),
  password: passwordSchema,
  pass: passwordSchema,
  clientid: clientIdSchema,
  clientId: clientIdSchema,
  topic: topicSchema,
  acc: accessSchema,
  access: accessSchema,
})
  .or("username", "user")
  .required()
  .messages({
    "object.missing":
      "username is required",
  })
  .unknown(true);

module.exports = Object.freeze({
  mqttValidateSchema,
});
