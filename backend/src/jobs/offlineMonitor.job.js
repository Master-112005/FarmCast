"use strict";

const db = require("../models");
const logger = require("../utils/logger");
const { ALERT, DEVICE, AUDIT } = require("../utils/constants");
const {
  createDeviceOfflineAlert,
} = require("../modules/alerts/alert.service");
const {
  logAuditEvent,
} = require("../modules/audit/audit.service");

const { Op } = db.Sequelize;

const hasOwnedUser = (device) =>
  typeof device?.userId === "string" &&
  device.userId.trim().length > 0;

const getOfflineCutoffDate = () =>
  new Date(
    Date.now() -
      ALERT.DEFAULTS.OFFLINE_WINDOW_MINUTES *
        60 *
        1000
  );

const markDeviceOffline = async (device) => {
  const updates = { isOnline: false };

  if (device.status === DEVICE.STATUS.ACTIVE) {
    updates.status = DEVICE.STATUS.OFFLINE;
  }

  await device.update(updates);

  if (hasOwnedUser(device)) {
    await createDeviceOfflineAlert({
      userId: device.userId,
      deviceId: device.id,
      lastSeenAt: device.lastSeenAt,
    });
  }

  await logAuditEvent({
    eventType: AUDIT.EVENTS.DEVICE_OFFLINE,
    actorType: AUDIT.ACTOR_TYPES.SYSTEM,
    actorId: "offline-monitor",
    targetDeviceId: device.deviceCode || device.id,
    metadata: {
      devicePk: device.id,
      userId: device.userId,
      lastSeenAt: device.lastSeenAt,
    },
  });
};

const scanOfflineDevices = async () => {
  if (!db.Device) return 0;

  const cutoffDate = getOfflineCutoffDate();

  const offlineCandidates = await db.Device.findAll({
    where: {
      isOnline: true,
      lastSeenAt: {
        [Op.not]: null,
        [Op.lt]: cutoffDate,
      },
    },
    attributes: [
      "id",
      "userId",
      "deviceCode",
      "status",
      "isOnline",
      "lastSeenAt",
    ],
  });

  if (!offlineCandidates.length) return 0;

  for (const device of offlineCandidates) {
    await markDeviceOffline(device);
  }

  logger.info("Offline monitor executed", {
    scanned: offlineCandidates.length,
    cutoffDate: cutoffDate.toISOString(),
  });

  return offlineCandidates.length;
};

const startOfflineMonitorJob = () => {
  const runSafely = async () => {
    try {
      await scanOfflineDevices();
    } catch (err) {
      logger.error("Offline monitor job failed", {
        message: err.message,
      });
    }
  };

  runSafely();

  const intervalId = setInterval(
    runSafely,
    ALERT.DEFAULTS.OFFLINE_MONITOR_INTERVAL_MS
  );

  if (typeof intervalId.unref === "function") {
    intervalId.unref();
  }

  logger.info("Offline monitor scheduler started", {
    intervalMs:
      ALERT.DEFAULTS.OFFLINE_MONITOR_INTERVAL_MS,
    offlineWindowMinutes:
      ALERT.DEFAULTS.OFFLINE_WINDOW_MINUTES,
  });

  return () => {
    clearInterval(intervalId);
    logger.info("Offline monitor scheduler stopped");
  };
};

module.exports = Object.freeze({
  scanOfflineDevices,
  startOfflineMonitorJob,
});
