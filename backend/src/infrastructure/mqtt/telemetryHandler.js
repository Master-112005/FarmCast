"use strict";

const { SoilRecord, Device, Crop } = require("../../models");
const logger = require("../../utils/logger");
const { DEVICE, AUDIT } = require("../../utils/constants");
const {
  processMoistureAlerts,
  resolveDeviceOfflineAlert,
} = require("../../modules/alerts/alert.service");
const {
  logAuditEvent,
} = require("../../modules/audit/audit.service");
const { getIO } = require("../../realtime/socket");

const DEVICE_ID_REGEX = /^fc-[A-Z0-9]{8}$/;
const TELEMETRY_TOPIC_REGEX =
  /^devices\/(fc-[A-Z0-9]{8})\/telemetry$/;
const HEARTBEAT_TOPIC_REGEX =
  /^devices\/(fc-[A-Z0-9]{8})\/heartbeat$/;
const FACTORY_RESET_TOPIC_REGEX =
  /^devices\/(fc-[A-Z0-9]{8})\/system\/reset$/;
const UNKNOWN_DEVICE_EVENT_THROTTLE_MS =
  10 * 60 * 1000;
const unknownDeviceEventSeenAt = new Map();

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

const hasUserId = (value) =>
  typeof value === "string" &&
  value.trim().length > 0;

const shouldThrottleUnknownDeviceEvent = ({
  deviceId,
  topic,
}) => {
  const key = `${String(deviceId || "")}|${String(topic || "")}`;
  const now = Date.now();
  const lastSeenAt = unknownDeviceEventSeenAt.get(key);
  unknownDeviceEventSeenAt.set(key, now);

  if (!Number.isFinite(lastSeenAt)) {
    return false;
  }

  return (
    now - lastSeenAt < UNKNOWN_DEVICE_EVENT_THROTTLE_MS
  );
};

const validateTelemetryPayload = (payload) => {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    throw new Error(
      "Telemetry payload must be an object"
    );
  }

  if (payload.gpsValid !== true) {
    throw new Error(
      "Telemetry rejected: gpsValid must be true"
    );
  }

  if (payload.soilValid !== true) {
    throw new Error(
      "Telemetry rejected: soilValid must be true"
    );
  }

  const moisture = toFiniteNumber(payload.moisture);
  const temperature = toFiniteNumber(payload.temperature);
  const latitude = toFiniteNumber(
    payload.lat !== undefined
      ? payload.lat
      : payload.latitude
  );
  const longitude = toFiniteNumber(
    payload.lng !== undefined
      ? payload.lng
      : payload.longitude
  );

  if (moisture === null) {
    throw new Error("Missing or invalid moisture");
  }

  if (temperature === null) {
    throw new Error(
      "Missing or invalid temperature"
    );
  }

  if (latitude === null || longitude === null) {
    throw new Error(
      "Missing or invalid latitude/longitude"
    );
  }

  if (moisture < 0 || moisture > 100) {
    throw new Error(
      "Moisture out of supported range 0-100"
    );
  }

  if (temperature < -20 || temperature > 80) {
    throw new Error(
      "Temperature out of supported range -20 to 80"
    );
  }

  if (latitude < -90 || latitude > 90) {
    throw new Error("Latitude out of range");
  }

  if (longitude < -180 || longitude > 180) {
    throw new Error("Longitude out of range");
  }

  if (
    Math.abs(latitude) < 0.000001 &&
    Math.abs(longitude) < 0.000001
  ) {
    throw new Error(
      "0,0 coordinates are not allowed"
    );
  }

  const battery = toFiniteNumber(payload.battery);

  return {
    moisture,
    temperature,
    latitude,
    longitude,
    battery,
  };
};

const parseTopic = (topic) => {
  const normalized = String(topic || "").trim();

  const telemetryMatch = normalized.match(
    TELEMETRY_TOPIC_REGEX
  );
  if (telemetryMatch) {
    return {
      type: "telemetry",
      deviceId: telemetryMatch[1],
    };
  }

  const heartbeatMatch = normalized.match(
    HEARTBEAT_TOPIC_REGEX
  );
  if (heartbeatMatch) {
    return {
      type: "heartbeat",
      deviceId: heartbeatMatch[1],
    };
  }

  const resetMatch = normalized.match(
    FACTORY_RESET_TOPIC_REGEX
  );
  if (resetMatch) {
    return {
      type: "factory_reset",
      deviceId: resetMatch[1],
    };
  }

  return null;
};

const loadDeviceByCode = async (deviceCode) => {
  if (!DEVICE_ID_REGEX.test(deviceCode)) {
    return null;
  }

  return Device.findOne({
    where: { deviceCode },
  });
};

const safeGetIO = () => {
  try {
    return getIO();
  } catch {
    return null;
  }
};

const auditOnlineTransition = async ({
  device,
  correlationId = null,
}) => {
  await logAuditEvent({
    eventType: AUDIT.EVENTS.DEVICE_ONLINE,
    actorType: AUDIT.ACTOR_TYPES.DEVICE,
    actorId: device.deviceCode,
    targetDeviceId: device.deviceCode,
    metadata: {
      devicePk: device.id,
      userId: device.userId,
    },
    correlationId,
  });
};

const rejectTelemetrySecurityEvent = async ({
  topic,
  deviceId,
  reason,
  logLevel = "warn",
  suppressAudit = false,
  suppressLog = false,
}) => {
  if (!suppressLog) {
    const logMethod =
      logLevel === "info" ? "info" : "warn";

    logger[logMethod]("Telemetry security event", {
      topic,
      deviceId,
      reason,
    });
  }

  if (!suppressAudit) {
    await logAuditEvent({
      eventType: AUDIT.EVENTS.DEVICE_AUTH_FAILED,
      actorType: AUDIT.ACTOR_TYPES.DEVICE,
      actorId: deviceId || null,
      targetDeviceId: deviceId || null,
      metadata: {
        reason,
        topic,
      },
    });
  }

  return {
    status: "rejected",
    reason,
    deviceId: deviceId || null,
    topic,
    auditRecorded: !suppressAudit,
  };
};

const handleTelemetryMessage = async (
  parsedTopic,
  rawPayload,
  topic,
  context = {}
) => {
  let data;
  try {
    data = JSON.parse(rawPayload);
  } catch {
    throw new Error("Invalid JSON payload");
  }

  if (
    data?.deviceId &&
    String(data.deviceId) !== parsedTopic.deviceId
  ) {
    return rejectTelemetrySecurityEvent({
      topic,
      deviceId: parsedTopic.deviceId,
      reason: "payload_topic_device_mismatch",
    });
  }

  const device = await loadDeviceByCode(
    parsedTopic.deviceId
  );
  if (!device) {
    const suppressDuplicateUnknown =
      context.isRetained !== true &&
      shouldThrottleUnknownDeviceEvent({
        deviceId: parsedTopic.deviceId,
        topic,
      });

    return rejectTelemetrySecurityEvent({
      topic,
      deviceId: parsedTopic.deviceId,
      reason: "unknown_device",
      logLevel: context.isRetained ? "info" : "warn",
      suppressAudit:
        context.isRetained === true ||
        suppressDuplicateUnknown,
      suppressLog:
        context.isRetained === true ||
        suppressDuplicateUnknown,
    });
  }

  const telemetry = validateTelemetryPayload(data);

  const wasOnline = device.isOnline === true;
  const nextStatus =
    device.status === DEVICE.STATUS.OFFLINE
      ? DEVICE.STATUS.ACTIVE
      : device.status;

  if (!hasUserId(device.userId)) {
    await device.update({
      lastSeenAt: new Date(),
      isOnline: true,
      status: nextStatus,
      latitude: telemetry.latitude,
      longitude: telemetry.longitude,
    });

    if (!wasOnline) {
      await auditOnlineTransition({ device });
    }

    logger.warn(
      "Telemetry ignored for unassigned device",
      {
        topic,
        deviceCode: device.deviceCode,
        devicePk: device.id,
      }
    );

    return {
      status: "ignored",
      reason: "unassigned_device",
      deviceId: device.deviceCode,
      topic,
    };
  }

  await SoilRecord.create({
    deviceId: device.id,
    userId: device.userId,
    moisture: telemetry.moisture,
    temperature: telemetry.temperature,
    latitude: telemetry.latitude,
    longitude: telemetry.longitude,
    battery: telemetry.battery,
  });

  await device.update({
    lastSeenAt: new Date(),
    isOnline: true,
    status: nextStatus,
    latitude: telemetry.latitude,
    longitude: telemetry.longitude,
  });

  const deviceWithCrop =
    (await Device.findByPk(device.id, {
      include: [
        {
          model: Crop,
          as: "crop",
          required: false,
        },
      ],
    })) || device;

  await processMoistureAlerts({
    userId: device.userId,
    device: deviceWithCrop,
    moisture: telemetry.moisture,
  });

  await resolveDeviceOfflineAlert({
    userId: device.userId,
    deviceId: device.id,
  });

  if (!wasOnline) {
    await auditOnlineTransition({ device });
  }

  logger.info("Telemetry saved successfully", {
    topic,
    deviceCode: device.deviceCode,
    devicePk: device.id,
    userId: device.userId,
    latitude: telemetry.latitude,
    longitude: telemetry.longitude,
  });

  const io = safeGetIO();
  if (io) {
    io.to(device.userId).emit("device:update", {
      deviceId: device.id,
      moisture: telemetry.moisture,
      temperature: telemetry.temperature,
      latitude: telemetry.latitude,
      longitude: telemetry.longitude,
      battery: telemetry.battery,
      timestamp: new Date().toISOString(),
    });
  }

  return {
    status: "processed",
    reason: null,
    deviceId: device.deviceCode,
    topic,
  };
};

const handleHeartbeatMessage = async (
  parsedTopic,
  rawPayload,
  topic,
  context = {}
) => {
  let payload = {};
  if (
    typeof rawPayload === "string" &&
    rawPayload.trim().length > 0
  ) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      throw new Error("Invalid JSON payload");
    }
  }

  if (
    payload?.deviceId &&
    String(payload.deviceId) !== parsedTopic.deviceId
  ) {
    return rejectTelemetrySecurityEvent({
      topic,
      deviceId: parsedTopic.deviceId,
      reason: "payload_topic_device_mismatch",
    });
  }

  const device = await loadDeviceByCode(
    parsedTopic.deviceId
  );
  if (!device) {
    const suppressDuplicateUnknown =
      context.isRetained !== true &&
      shouldThrottleUnknownDeviceEvent({
        deviceId: parsedTopic.deviceId,
        topic,
      });

    return rejectTelemetrySecurityEvent({
      topic,
      deviceId: parsedTopic.deviceId,
      reason: "unknown_device",
      logLevel: context.isRetained ? "info" : "warn",
      suppressAudit:
        context.isRetained === true ||
        suppressDuplicateUnknown,
      suppressLog:
        context.isRetained === true ||
        suppressDuplicateUnknown,
    });
  }

  const wasOnline = device.isOnline === true;
  const nextStatus =
    device.status === DEVICE.STATUS.OFFLINE
      ? DEVICE.STATUS.ACTIVE
      : device.status;

  await device.update({
    lastSeenAt: new Date(),
    isOnline: true,
    status: nextStatus,
  });

  if (hasUserId(device.userId)) {
    await resolveDeviceOfflineAlert({
      userId: device.userId,
      deviceId: device.id,
    });
  }

  if (!wasOnline) {
    await auditOnlineTransition({ device });
  }

  logger.info("Heartbeat processed", {
    topic,
    deviceCode: device.deviceCode,
    devicePk: device.id,
    userId: device.userId,
  });

  return {
    status: "processed",
    reason: null,
    deviceId: device.deviceCode,
    topic,
  };
};

const handleFactoryResetMessage = async (
  parsedTopic,
  rawPayload,
  topic,
  context = {}
) => {
  let payload = {};
  if (
    typeof rawPayload === "string" &&
    rawPayload.trim().length > 0
  ) {
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      throw new Error("Invalid JSON payload");
    }
  }

  const device = await loadDeviceByCode(
    parsedTopic.deviceId
  );
  if (!device) {
    const suppressDuplicateUnknown =
      context.isRetained !== true &&
      shouldThrottleUnknownDeviceEvent({
        deviceId: parsedTopic.deviceId,
        topic,
      });

    return rejectTelemetrySecurityEvent({
      topic,
      deviceId: parsedTopic.deviceId,
      reason: "unknown_device",
      logLevel: context.isRetained ? "info" : "warn",
      suppressAudit:
        context.isRetained === true ||
        suppressDuplicateUnknown,
      suppressLog:
        context.isRetained === true ||
        suppressDuplicateUnknown,
    });
  }

  await logAuditEvent({
    eventType:
      AUDIT.EVENTS.DEVICE_FACTORY_RESET,
    actorType: AUDIT.ACTOR_TYPES.DEVICE,
    actorId: parsedTopic.deviceId,
    targetDeviceId: parsedTopic.deviceId,
    metadata: {
      topic,
      event:
        payload?.event || "factory_reset",
      devicePk: device.id,
      userId: device.userId,
    },
  });

  logger.warn("Factory reset event received", {
    topic,
    deviceCode: parsedTopic.deviceId,
    devicePk: device.id,
  });

  return {
    status: "processed",
    reason: null,
    deviceId: parsedTopic.deviceId,
    topic,
  };
};

async function handleDeviceMessage(
  topic,
  rawPayload,
  context = {}
) {
  const parsedTopic = parseTopic(topic);
  if (!parsedTopic) {
    return rejectTelemetrySecurityEvent({
      topic,
      deviceId: null,
      reason: "invalid_topic_structure",
    });
  }

  try {
    if (parsedTopic.type === "telemetry") {
      return handleTelemetryMessage(
        parsedTopic,
        rawPayload,
        topic,
        context
      );
    }

    if (parsedTopic.type === "heartbeat") {
      return handleHeartbeatMessage(
        parsedTopic,
        rawPayload,
        topic,
        context
      );
    }

    if (parsedTopic.type === "factory_reset") {
      return handleFactoryResetMessage(
        parsedTopic,
        rawPayload,
        topic,
        context
      );
    }

    return {
      status: "ignored",
      reason: "unsupported_topic_type",
      deviceId: parsedTopic.deviceId,
      topic,
    };
  } catch (error) {
    logger.error("MQTT message processing error", {
      topic,
      type: parsedTopic.type,
      message: error.message,
    });

    return {
      status: "error",
      reason: "processing_error",
      deviceId: parsedTopic.deviceId || null,
      topic,
      message: error.message,
    };
  }
}

module.exports = { handleDeviceMessage };
