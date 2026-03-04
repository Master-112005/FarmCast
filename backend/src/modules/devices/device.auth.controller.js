/**
 * src/modules/devices/device.auth.controller.js
 * ------------------------------------------------------
 * Device Authentication Controller
 *
 * Responsibilities:
 * - Accept validated auth payload
 * - Delegate auth logic to service
 * - Return standardized API responses
 */

"use strict";

const response = require("../../utils/response");
const deviceAuthService = require("./device.auth.service");

const authenticateDevice = async (
  req,
  res,
  next
) => {
  try {
    const result =
      await deviceAuthService.authenticateDevice(
        req.body,
        {
          correlationId: req.correlationId,
        }
      );

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = Object.freeze({
  authenticateDevice,
});
