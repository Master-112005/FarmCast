"use strict";

const db = require("../../models");
const logger = require("../../utils/logger");
const { ERROR_CODES } = require("../../utils/constants");

const { Op } = db.Sequelize;



const SOIL_ERRORS = Object.freeze({
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  DEVICE_ACCESS_DENIED: "DEVICE_ACCESS_DENIED",
  SOIL_RECORD_NOT_FOUND:
    ERROR_CODES.RESOURCE_NOT_FOUND,
});

/**
 * Build domain error (handled by global error middleware)
 */
const domainError = (
  code,
  message,
  status = 400
) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};



/**
 * Ensure device exists and is owned by user
 */
const getOwnedDevice = async (
  deviceId,
  userId
) => {
  const device = await db.Device.findByPk(deviceId);

  if (!device) {
    throw domainError(
      SOIL_ERRORS.DEVICE_NOT_FOUND,
      "Device not found",
      404
    );
  }

  if (device.userId !== userId) {
    throw domainError(
      SOIL_ERRORS.DEVICE_ACCESS_DENIED,
      "Access to device denied",
      403
    );
  }

  return device;
};



/**
 * Create a new soil telemetry record
 *
 * Used by:
 * - Manual device sync
 * - IoT ingestion (future)
 */
const createSoilRecord = async (
  userId,
  payload
) => {
  const gpsValid = payload?.gpsValid;
  const soilValid = payload?.soilValid;

  const {
    deviceId,
    recordedAt,
    latitude: payloadLatitude,
    longitude: payloadLongitude,
    lat,
    lng,
    ...metrics
  } = payload;

  // Ownership enforcement
  await getOwnedDevice(deviceId, userId);

  const latitude =
    payloadLatitude !== undefined
      ? payloadLatitude
      : lat;
  const longitude =
    payloadLongitude !== undefined
      ? payloadLongitude
      : lng;

  const telemetryPayloadPresent =
    gpsValid !== undefined ||
    soilValid !== undefined ||
    latitude !== undefined ||
    longitude !== undefined;

  if (telemetryPayloadPresent) {
    const latNumber = Number(latitude);
    const lngNumber = Number(longitude);

    if (gpsValid !== true) {
      throw domainError(
        "INVALID_GPS_TELEMETRY",
        "gpsValid must be true",
        400
      );
    }

    if (soilValid !== true) {
      throw domainError(
        "INVALID_SOIL_TELEMETRY",
        "soilValid must be true",
        400
      );
    }

    if (
      !Number.isFinite(latNumber) ||
      !Number.isFinite(lngNumber)
    ) {
      throw domainError(
        "INVALID_COORDINATES",
        "latitude and longitude must be numeric",
        400
      );
    }

    if (
      latNumber < -90 ||
      latNumber > 90 ||
      lngNumber < -180 ||
      lngNumber > 180
    ) {
      throw domainError(
        "INVALID_COORDINATES",
        "latitude/longitude out of range",
        400
      );
    }

    if (
      Math.abs(latNumber) < 0.000001 &&
      Math.abs(lngNumber) < 0.000001
    ) {
      throw domainError(
        "INVALID_COORDINATES",
        "0,0 coordinates are not allowed",
        400
      );
    }
  }

  delete metrics.gpsValid;
  delete metrics.soilValid;

  const record = await db.SoilRecord.create({
    deviceId,
    userId,
    ...metrics,
    ...(latitude !== undefined
      ? { latitude: Number(latitude) }
      : {}),
    ...(longitude !== undefined
      ? { longitude: Number(longitude) }
      : {}),
    ...(recordedAt
      ? {
          createdAt: new Date(recordedAt),
          updatedAt: new Date(recordedAt),
        }
      : {}),
  });

  logger.info("Soil record created", {
    soilRecordId: record.id,
    deviceId,
    userId,
  });

  return record;
};



/**
 * Fetch soil history for a device
 *
 * Used for:
 * - Charts
 * - Trends
 * - ML feature inputs
 */
const getSoilHistory = async (
  userId,
  {
    deviceId,
    from,
    to,
    limit = 100,
  },
) => {
  // Ownership enforcement
  await getOwnedDevice(deviceId, userId);

  const where = { deviceId };

  if (from) {
    where.createdAt = {
      ...(where.createdAt || {}),
      [Op.gte]: new Date(from),
    };
  }

  if (to) {
    where.createdAt = {
      ...(where.createdAt || {}),
      [Op.lte]: new Date(to),
    };
  }

  const records =
    await db.SoilRecord.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
    });

  return records;
};



/**
 * Fetch latest soil record for a device
 *
 * Used by:
 * - Dashboard summary cards
 */
const getLatestSoilRecord = async (
  userId,
  deviceId
) => {
  // Ownership enforcement
  await getOwnedDevice(deviceId, userId);

  const record =
    await db.SoilRecord.findOne({
      where: { deviceId },
      order: [["createdAt", "DESC"]],
    });

  if (!record) {
    throw domainError(
      SOIL_ERRORS.SOIL_RECORD_NOT_FOUND,
      "No soil data available",
      404
    );
  }

  return record;
};



module.exports = {
  createSoilRecord,
  getSoilHistory,
  getLatestSoilRecord,
};
