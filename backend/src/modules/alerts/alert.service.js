"use strict";

const db = require("../../models");
const logger = require("../../utils/logger");
const { ALERT } = require("../../utils/constants");
const { getIO } = require("../../realtime/socket");
const {
  resolveMoistureMinThreshold,
  resolveMoistureMaxThreshold,
} = require("./thresholdResolver");

const toFiniteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasIdentifier = (value) =>
  typeof value === "string" &&
  value.trim().length > 0;

const safeGetIO = () => {
  try {
    return getIO();
  } catch (_error) {
    return null;
  }
};

const toAlertPayload = (alert, extras = {}) => ({
  alertId: alert.id,
  userId: alert.userId,
  deviceId: alert.deviceId,
  type: alert.type,
  message: alert.message,
  value: toFiniteNumber(alert.value),
  threshold: toFiniteNumber(alert.threshold),
  resolved: Boolean(alert.resolved),
  timestamp: new Date(),
  ...extras,
});

const emitAlertEvent = (event, userId, payload) => {
  if (!hasIdentifier(userId)) {
    return;
  }

  const io = safeGetIO();
  if (!io) return;

  io.to(userId).emit(event, payload);
};

const findUnresolvedAlert = async ({
  userId,
  deviceId,
  type,
}) =>
  db.Alert.findOne({
    where: {
      userId,
      deviceId,
      type,
      resolved: false,
    },
    order: [["createdAt", "DESC"]],
  });

const createAlertIfMissing = async ({
  userId,
  deviceId,
  type,
  message,
  value = null,
  threshold = null,
  emit = true,
}) => {
  if (
    !hasIdentifier(userId) ||
    !hasIdentifier(deviceId) ||
    !hasIdentifier(type)
  ) {
    return {
      alert: null,
      created: false,
      skipped: true,
    };
  }

  const existing = await findUnresolvedAlert({
    userId,
    deviceId,
    type,
  });

  if (existing) {
    return { alert: existing, created: false };
  }

  const alert = await db.Alert.create({
    userId,
    deviceId,
    type,
    message,
    value: toFiniteNumber(value),
    threshold: toFiniteNumber(threshold),
    resolved: false,
  });

  if (emit) {
    emitAlertEvent(
      "alert:new",
      userId,
      toAlertPayload(alert)
    );
  }

  logger.info("Alert created", {
    alertId: alert.id,
    userId,
    deviceId,
    type,
  });

  return { alert, created: true };
};

const resolveOpenAlert = async ({
  userId,
  deviceId,
  type,
  resolvedMessage = "Alert resolved",
  value = null,
  threshold = null,
  emit = true,
}) => {
  if (
    !hasIdentifier(userId) ||
    !hasIdentifier(deviceId) ||
    !hasIdentifier(type)
  ) {
    return {
      alert: null,
      resolved: false,
      skipped: true,
    };
  }

  const existing = await findUnresolvedAlert({
    userId,
    deviceId,
    type,
  });

  if (!existing) {
    return { alert: null, resolved: false };
  }

  existing.resolved = true;
  await existing.save();

  if (emit) {
    emitAlertEvent(
      "alert:resolved",
      userId,
      toAlertPayload(existing, {
        message: resolvedMessage,
        value: toFiniteNumber(value),
        threshold: toFiniteNumber(threshold),
        resolved: true,
      })
    );
  }

  logger.info("Alert resolved", {
    alertId: existing.id,
    userId,
    deviceId,
    type,
  });

  return { alert: existing, resolved: true };
};

const processMoistureAlerts = async ({
  userId,
  device,
  moisture,
}) => {
  if (!device || !userId) {
    return null;
  }

  const moistureValue = toFiniteNumber(moisture);
  if (moistureValue === null) {
    return null;
  }

  const minThreshold =
    resolveMoistureMinThreshold(device);
  const maxThreshold =
    resolveMoistureMaxThreshold(device);

  if (
    minThreshold !== null &&
    moistureValue < minThreshold
  ) {
    await createAlertIfMissing({
      userId,
      deviceId: device.id,
      type: ALERT.TYPES.MOISTURE_LOW,
      message: "Soil moisture below threshold",
      value: moistureValue,
      threshold: minThreshold,
    });
  } else {
    await resolveOpenAlert({
      userId,
      deviceId: device.id,
      type: ALERT.TYPES.MOISTURE_LOW,
      resolvedMessage:
        "Soil moisture returned to normal",
      value: moistureValue,
      threshold: minThreshold,
    });
  }

  if (
    maxThreshold !== null &&
    moistureValue > maxThreshold
  ) {
    await createAlertIfMissing({
      userId,
      deviceId: device.id,
      type: ALERT.TYPES.MOISTURE_HIGH,
      message: "Soil moisture above threshold",
      value: moistureValue,
      threshold: maxThreshold,
    });
  } else {
    await resolveOpenAlert({
      userId,
      deviceId: device.id,
      type: ALERT.TYPES.MOISTURE_HIGH,
      resolvedMessage:
        "Soil moisture returned below max threshold",
      value: moistureValue,
      threshold: maxThreshold,
    });
  }

  return {
    minThreshold,
    maxThreshold,
  };
};

const createDeviceOfflineAlert = async ({
  userId,
  deviceId,
  lastSeenAt = null,
}) =>
  createAlertIfMissing({
    userId,
    deviceId,
    type: ALERT.TYPES.DEVICE_OFFLINE,
    message: "Device is offline",
    value: null,
    threshold:
      ALERT.DEFAULTS.OFFLINE_WINDOW_MINUTES,
    emit: true,
    ...(lastSeenAt
      ? {
          message: `Device is offline. Last seen at ${new Date(
            lastSeenAt
          ).toISOString()}`,
        }
      : {}),
  });

const resolveDeviceOfflineAlert = async ({
  userId,
  deviceId,
}) =>
  resolveOpenAlert({
    userId,
    deviceId,
    type: ALERT.TYPES.DEVICE_OFFLINE,
    resolvedMessage: "Device is back online",
  });

module.exports = Object.freeze({
  processMoistureAlerts,
  createDeviceOfflineAlert,
  resolveDeviceOfflineAlert,
  createAlertIfMissing,
  resolveOpenAlert,
});
