"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");

const env = require("../../config/env");
const logger = require("../../utils/logger");
const validate = require("../../middlewares/validate.middleware");
const {
  ERROR_CODES,
} = require("../../utils/constants");

const mqttController = require("./mqtt.controller");
const { mqttValidateSchema } = require("./mqtt.schema");

const router = express.Router();

const normalizeBrokerPayload = (req, _res, next) => {
  let normalized = {};

  if (
    req.body &&
    typeof req.body === "object" &&
    !Array.isArray(req.body)
  ) {
    normalized = { ...req.body };
  } else if (
    typeof req.body === "string" &&
    req.body.trim().length > 0
  ) {
    try {
      normalized = JSON.parse(req.body);
    } catch {
      normalized = {};
    }
  }

  if (
    req.query &&
    typeof req.query === "object" &&
    Object.keys(req.query).length > 0
  ) {
    normalized = {
      ...req.query,
      ...normalized,
    };
  }

  req.body = normalized;
  next();
};

const mqttValidateLimiter = rateLimit({
  windowMs:
    env.MQTT_AUTH.RATE_LIMIT_WINDOW_MS,
  max: env.MQTT_AUTH.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    logger.warn("MQTT validate rate limit exceeded", {
      ip: req.ip,
      path: req.originalUrl,
    });

    res.status(429).json({
      success: false,
      status: 429,
      code: ERROR_CODES.RATE_LIMITED,
      message:
        "Too many requests. Please slow down and try again.",
      correlationId: req.correlationId,
    });
  },
});

/**
 * POST /api/v1/mqtt/validate
 * Broker callback endpoint for CONNECT/ACL/superuser checks.
 * Some broker integrations may append a trailing "." to the path,
 * so both variants are accepted for compatibility.
 */
const mqttValidateHandlers = [
  mqttValidateLimiter,
  normalizeBrokerPayload,
  validate({ body: mqttValidateSchema }),
  mqttController.validateBrokerRequest,
];

router.post(
  "/validate",
  ...mqttValidateHandlers
);

router.post(
  "/validate.",
  ...mqttValidateHandlers
);

module.exports = Object.freeze(router);
