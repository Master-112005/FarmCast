/**
 * src/modules/devices/device.controller.js
 * ------------------------------------------------------
 * Device Controller
 *
 * CRITICAL FILE (HTTP ↔ DEVICE DOMAIN ADAPTER)
 *
 * Responsibilities:
 * - Handle HTTP requests for device operations
 * - Delegate all logic to device.service
 * - Return standardized API responses
 *
 * Rules:
 * - NO business logic
 * - NO database access
 * - NO RBAC decisions here
 *
 * If this file is wrong → device flows break
 */

"use strict";

const deviceService = require("./device.service");
const response = require("../../utils/response");
const { ROLES } = require("../../utils/constants");
const asyncHandler = require("../../middlewares/asyncHandler.middleware");

/* ======================================================
   USER: DEVICE OPERATIONS
====================================================== */

/**
 * GET /api/v1/devices
 */
const getMyDevices = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const devices =
      await deviceService.getMyDevices(userId);

    return response.success(res, devices);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/devices/:id
 */
const getMyDeviceById = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;
    const device =
      await deviceService.getMyDeviceById(
        deviceId,
        userId
      );

    return response.success(res, device);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/devices/:id/status
 */
const getDeviceStatus = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const identifier = req.params.id;
    const status =
      await deviceService.getDeviceStatus(
        userId,
        identifier
      );

    return response.success(res, status);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/devices
 */
const createDevice = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const payload = req.body;

    const device =
      await deviceService.createDevice(
        userId,
        payload
      );

    return response.created(res, device);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/devices/provision
 */
const provisionDevice = asyncHandler(
  async (req, res) => {
    const userId = req.user.id;
    const payload = req.body;

    const provisioned =
      await deviceService.provisionDevice(
        userId,
        payload,
        {
          correlationId: req.correlationId,
        }
      );

    return response.created(res, provisioned);
  }
);

/**
 * PUT /api/v1/devices/:id
 */
const updateMyDevice = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;
    const updates = req.body;
    const device =
      await deviceService.updateMyDevice(
        deviceId,
        userId,
        updates,
        req.user.role === ROLES.ADMIN
      );

    return response.success(res, device);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/devices/:id
 */
const deleteDevice = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;
    await deviceService.deleteDevice(
      deviceId,
      userId
    );

    return response.noContent(res);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/devices/:id/pre-delete
 */
const preDeleteDevice = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;
    const data =
      await deviceService.preDeleteDevice(
        deviceId,
        userId,
        {
          correlationId: req.correlationId,
        }
      );

    return response.success(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/devices/:id/finalize-delete
 */
const finalizeDeleteDevice = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;
    const data =
      await deviceService.finalizeDeleteDevice(
        deviceId,
        userId,
        {
          correlationId: req.correlationId,
        }
      );

    return response.success(res, data);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   IOT / LIVE DATA
====================================================== */

/**
 * GET /api/v1/devices/:id/live
 */
const getLiveDeviceData = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;
    const data =
      await deviceService.getLiveDeviceData(
        deviceId,
        userId
      );

    return response.success(res, data);
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/v1/devices/sync/:id
 */
const syncDeviceData = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const deviceId = req.params.id;
    const payload = req.body;
    const record = await deviceService.syncDeviceData(
      deviceId,
      userId,
      payload
    );

    return response.success(res, record);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  // User
  getMyDevices,
  getMyDeviceById,
  getDeviceStatus,
  createDevice,
  provisionDevice,
  updateMyDevice,
  deleteDevice,
  preDeleteDevice,
  finalizeDeleteDevice,

  // IoT
  getLiveDeviceData,
  syncDeviceData,

};
