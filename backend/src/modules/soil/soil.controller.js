"use strict";

const soilService = require("./soil.service");
const response = require("../../utils/response");

const buildValidationError = (message) => {
  const err = new Error(message);
  err.status = 400;
  err.code = "VALIDATION_ERROR";
  return err;
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateTelemetryCoordinates = (payload = {}) => {
  if (payload.gpsValid !== true) {
    throw buildValidationError("Telemetry rejected: gpsValid must be true");
  }

  if (payload.soilValid !== true) {
    throw buildValidationError("Telemetry rejected: soilValid must be true");
  }

  const latitude = toFiniteNumber(
    payload.lat !== undefined ? payload.lat : payload.latitude
  );
  const longitude = toFiniteNumber(
    payload.lng !== undefined ? payload.lng : payload.longitude
  );

  if (latitude === null || longitude === null) {
    throw buildValidationError("Telemetry rejected: latitude/longitude must be numeric");
  }

  if (latitude < -90 || latitude > 90) {
    throw buildValidationError("Telemetry rejected: latitude out of range");
  }

  if (longitude < -180 || longitude > 180) {
    throw buildValidationError("Telemetry rejected: longitude out of range");
  }

  if (Math.abs(latitude) < 0.000001 && Math.abs(longitude) < 0.000001) {
    throw buildValidationError("Telemetry rejected: 0,0 coordinates are not allowed");
  }

  return {
    ...payload,
    latitude,
    longitude,
  };
};



/**
 * POST /api/v1/soil
 *
 * Create a new soil telemetry record
 */
const createSoilRecord = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = validateTelemetryCoordinates(req.body || {});
    const record =
      await soilService.createSoilRecord(
        userId,
        payload
      );

    return response.created(res, record);
  } catch (err) {
    next(err);
  }
};



/**
 * GET /api/v1/soil/history
 *
 * Fetch soil history for charts & analytics
 */
const getSoilHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = req.query;
    const records =
      await soilService.getSoilHistory(
        userId,
        query
      );

    return response.success(res, records);
  } catch (err) {
    next(err);
  }
};



/**
 * GET /api/v1/soil/latest/:deviceId
 *
 * Fetch latest soil data for dashboard summary
 */
const getLatestSoilRecord = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.deviceId;
    const record =
      await soilService.getLatestSoilRecord(
        userId,
        deviceId
      );

    return response.success(res, record);
  } catch (err) {
    next(err);
  }
};



module.exports = {
  createSoilRecord,
  getSoilHistory,
  getLatestSoilRecord,
};
