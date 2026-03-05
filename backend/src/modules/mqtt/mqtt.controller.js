"use strict";

const response = require("../../utils/response");
const logger = require("../../utils/logger");
const mqttService = require("./mqtt.service");

const validateBrokerRequest = async (
  req,
  res,
  next
) => {
  try {
    // Intentionally logs only shape metadata (never raw password/JWT).
    if (process.env.NODE_ENV !== "production") {
      const body = req.body || {};
      logger.debug("MQTT validate callback payload", {
        keys: Object.keys(body),
        hasPassword:
          Object.prototype.hasOwnProperty.call(
            body,
            "password"
          ) ||
          Object.prototype.hasOwnProperty.call(
            body,
            "pass"
          ),
      });
    }

    const result =
      await mqttService.evaluateMqttValidation(
        req.body
      );

    if (!result.allowed) {
      return response.unauthorized(
        res,
        "Invalid credentials"
      );
    }

    return response.success(res, {
      allowed: true,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = Object.freeze({
  validateBrokerRequest,
});
