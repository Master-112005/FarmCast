"use strict";

const db = require("../../models");
const crypto = require("crypto");
const os = require("os");
const { Op } = require("sequelize");
const env = require("../../config/env");
const logger = require("../../utils/logger");
const { ERROR_CODES } = require("../../utils/constants");
const {
  DEVICE_ERRORS,
  DEVICE_LIMITS,
  DEVICE_TYPES,
} = require("./device.constants");
const {
  generateDeviceSecret,
  hashDeviceSecret,
} = require("./device.auth.service");
const {
  buildFertilizerRecommendation,
  buildWaterRecommendation,
  deriveSeasonLabel,
} = require("../predictors/predictor.service");
const { AUDIT } = require("../../utils/constants");
const {
  logAuditEvent,
} = require("../audit/audit.service");
const {
  getClient: getMqttClient,
} = require("../../infrastructure/mqtt/mqttClient");



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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const DEVICE_ID_RANDOM_LENGTH = 8;
const DEVICE_ID_GENERATION_MAX_ATTEMPTS = 10;
const LOOPBACK_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);
const WIFI_PASSWORD_MIN_LENGTH = 8;

const generateProvisioningDeviceId = () => {
  const bytes = crypto.randomBytes(
    DEVICE_ID_RANDOM_LENGTH
  );
  let suffix = "";

  for (let i = 0; i < bytes.length; i += 1) {
    suffix +=
      DEVICE_ID_ALPHABET[
        bytes[i] % DEVICE_ID_ALPHABET.length
      ];
  }

  return `fc-${suffix}`;
};

const reserveUniqueProvisioningDeviceId = async () => {
  for (
    let attempt = 0;
    attempt < DEVICE_ID_GENERATION_MAX_ATTEMPTS;
    attempt += 1
  ) {
    const candidate = generateProvisioningDeviceId();
    const existing = await db.Device.findOne({
      where: { deviceCode: candidate },
      attributes: ["id"],
    });

    if (!existing) {
      return candidate;
    }
  }

  throw domainError(
    ERROR_CODES.INTERNAL_ERROR,
    "Unable to allocate device identity",
    500
  );
};

const isLoopbackHost = (host) =>
  LOOPBACK_HOSTS.has(String(host || "").toLowerCase());

const privateNetworkRank = (address) => {
  if (address === "192.168.137.1") {
    return 0;
  }

  if (address.startsWith("192.168.")) {
    return 1;
  }

  if (address.startsWith("10.")) {
    return 2;
  }

  const segments = address.split(".");
  const secondOctet = Number(segments[1]);
  if (
    address.startsWith("172.") &&
    Number.isFinite(secondOctet) &&
    secondOctet >= 16 &&
    secondOctet <= 31
  ) {
    return 3;
  }

  return 9;
};

const listReachableIpv4Addresses = () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces || {}).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.family !== "IPv4" || entry.internal) {
        return;
      }
      addresses.push(entry.address);
    });
  });

  return addresses.sort((left, right) => {
    const rankDiff =
      privateNetworkRank(left) - privateNetworkRank(right);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return left.localeCompare(right);
  });
};

const selectDeviceReachableHost = () => {
  try {
    const appHost = new URL(env.APP_BASE_URL).hostname;
    if (appHost && !isLoopbackHost(appHost)) {
      return appHost;
    }
  } catch {
    // ignore malformed APP_BASE_URL, fallback to network interfaces
  }

  try {
    const mqttHost = new URL(
      env.MQTT.BROKER_URL
    ).hostname;
    if (mqttHost && !isLoopbackHost(mqttHost)) {
      return mqttHost;
    }
  } catch {
    // ignore malformed broker URL, fallback to network interfaces
  }

  const candidates = listReachableIpv4Addresses();
  return candidates[0] || null;
};

const resolveDeviceApiBaseUrl = () => {
  try {
    const parsed = new URL(env.APP_BASE_URL);
    const host =
      selectDeviceReachableHost() || parsed.hostname;
    const port = parsed.port
      ? `:${parsed.port}`
      : "";
    return `${parsed.protocol}//${host}${port}`;
  } catch {
    return null;
  }
};

const resolveDeviceMqttHost = () => {
  try {
    const brokerHost = new URL(
      env.MQTT.BROKER_URL
    ).hostname;
    if (brokerHost && !isLoopbackHost(brokerHost)) {
      return brokerHost;
    }
  } catch {
    // ignore malformed broker URL and fallback
  }

  return selectDeviceReachableHost();
};

const clearRetainedDeviceTopics = async (
  deviceCode
) => {
  if (!deviceCode) {
    return;
  }

  const client = getMqttClient();
  if (!client) {
    return;
  }

  const topics = [
    `devices/${deviceCode}/telemetry`,
    `devices/${deviceCode}/heartbeat`,
    `devices/${deviceCode}/system/reset`,
    `devices/${deviceCode}/wifi/update`,
  ];

  await Promise.all(
    topics.map(
      (topic) =>
        new Promise((resolve) => {
          client.publish(
            topic,
            "",
            { qos: 1, retain: true },
            (error) => {
              if (error) {
                logger.warn(
                  "Failed clearing retained device topic",
                  {
                    topic,
                    deviceCode,
                    message: error.message,
                  }
                );
              }
              resolve();
            }
          );
        })
    )
  );
};

const publishMqttMessage = async (
  topic,
  payload,
  options = {}
) => {
  const client = getMqttClient();
  if (!client?.connected) {
    throw domainError(
      ERROR_CODES.INTERNAL_ERROR,
      "MQTT broker unavailable for device update",
      503
    );
  }

  const qos =
    Number.isInteger(options.qos) &&
    options.qos >= 0 &&
    options.qos <= 2
      ? options.qos
      : 1;
  const retain = options.retain === true;

  await new Promise((resolve, reject) => {
    client.publish(
      topic,
      payload,
      { qos, retain },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
};

const queuePendingWifiUpdate = async (
  device,
  ssid,
  password,
  requestedAt
) => {
  try {
    await device.update({
      pendingWifiSsid: ssid,
      pendingWifiPassword: password,
      pendingWifiRequestedAt: requestedAt,
    });
    return true;
  } catch (error) {
    const message = String(
      error?.message || ""
    ).toLowerCase();

    if (
      message.includes("unknown column") &&
      (message.includes("pending_wifi_ssid") ||
        message.includes(
          "pending_wifi_password"
        ) ||
        message.includes(
          "pending_wifi_requested_at"
        ))
    ) {
      logger.warn(
        "Pending WiFi queue columns missing. Run latest migrations.",
        {
          deviceId: device?.id || null,
          deviceCode:
            device?.deviceCode || null,
        }
      );
      return false;
    }

    throw error;
  }
};

const isMissingPendingWifiColumnError = (
  error
) => {
  const message = String(
    error?.message || ""
  ).toLowerCase();

  return (
    message.includes("unknown column") &&
    (message.includes("pending_wifi_ssid") ||
      message.includes("pending_wifi_password") ||
      message.includes(
        "pending_wifi_requested_at"
      ))
  );
};

const sendWifiCredentialsUpdate = async (
  device,
  wifiSsid,
  wifiPassword
) => {
  const nextSsid = String(wifiSsid || "").trim();
  const nextPassword = String(wifiPassword || "");

  if (!nextSsid || !nextPassword) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_UPDATE_INVALID,
      "Both wifiSsid and wifiPassword are required",
      400
    );
  }

  if (nextPassword.length < WIFI_PASSWORD_MIN_LENGTH) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_UPDATE_INVALID,
      `WiFi password must be at least ${WIFI_PASSWORD_MIN_LENGTH} characters`,
      400
    );
  }

  if (!device?.deviceCode) {
    throw domainError(
      ERROR_CODES.INTERNAL_ERROR,
      "Device code unavailable for WiFi update",
      500
    );
  }

  const topic = `devices/${device.deviceCode}/wifi/update`;
  const requestedAt = new Date();
  const payload = JSON.stringify({
    ssid: nextSsid,
    password: nextPassword,
    requestedAt: requestedAt.toISOString(),
  });

  const pendingStored =
    await queuePendingWifiUpdate(
    device,
    nextSsid,
    nextPassword,
    requestedAt
    );

  let mqttPublished = false;
  try {
    // Retain the latest WiFi command so a temporarily offline device can
    // apply it on next MQTT reconnect.
    await publishMqttMessage(topic, payload, {
      qos: 1,
      retain: true,
    });
    mqttPublished = true;
  } catch (error) {
    // Do not fail the user request when broker/device is offline.
    // If pending queue storage succeeded, auth-response fallback can still
    // deliver this update when device reconnects to HTTP.
    logger.warn("Device WiFi update publish deferred", {
      deviceId: device.id,
      deviceCode: device.deviceCode,
      message: error.message,
      fallback: pendingStored
        ? "pending_auth_delivery"
        : "mqtt_only",
    });
  }

  logger.info("Device WiFi update command queued", {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    mqttPublished,
    pendingAuthDelivery: pendingStored,
  });

  return {
    mqttPublished,
    pendingAuthDelivery: pendingStored,
  };
};

/**
 * Ensure device exists
 */
const getDeviceById = async (deviceId) => {
  const device = await db.Device.findByPk(
    deviceId
  );

  if (!device) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_NOT_FOUND,
      "Device not found",
      404
    );
  }

  return device;
};

/**
 * Ensure user owns device
 */
const assertOwnership = (device, userId) => {
  if (device.userId !== userId) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_ACCESS_DENIED,
      "Access to device denied",
      403
    );
  }
};



/**
 * Get all devices for current user
 */
const getMyDevices = async (userId) => {
  return db.Device.findAll({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
};

/**
 * Get single device (owner only)
 */
const getMyDeviceById = async (deviceId, userId) => {
  const device = await getDeviceById(
    deviceId
  );

  assertOwnership(device, userId);

  return device;
};

const getDeviceStatus = async (
  userId,
  identifier
) => {
  const normalizedIdentifier = String(
    identifier || ""
  ).trim();

  if (!normalizedIdentifier) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "Device identifier is required",
      400
    );
  }

  const where = UUID_REGEX.test(
    normalizedIdentifier
  )
    ? {
        [Op.or]: [
          { id: normalizedIdentifier },
          { deviceCode: normalizedIdentifier },
        ],
      }
    : {
        deviceCode: normalizedIdentifier,
      };

  const device = await db.Device.findOne({
    where,
    attributes: [
      "id",
      "userId",
      "deviceCode",
      "status",
      "isOnline",
      "lastSeenAt",
    ],
  });

  if (!device) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_NOT_FOUND,
      "Device not found",
      404
    );
  }

  assertOwnership(device, userId);

  const now = Date.now();
  const lastSeenMs = device.lastSeenAt
    ? new Date(device.lastSeenAt).getTime()
    : 0;
  const seenRecently =
    Number.isFinite(lastSeenMs) &&
    lastSeenMs > 0 &&
    now - lastSeenMs <= 30_000;

  return {
    id: device.id,
    deviceId: device.deviceCode,
    status: device.status,
    isOnline: device.isOnline === true,
    lastSeenAt: device.lastSeenAt,
    online:
      device.isOnline === true || seenRecently,
    seenRecently,
  };
};

/**
 * Register new device
 */
const createDevice = async (
  userId,
  payload
) => {
  const count = await db.Device.count({
    where: { userId },
  });

  if (
    count >=
    DEVICE_LIMITS.MAX_DEVICES_PER_USER
  ) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_LIMIT_REACHED,
      "Device limit reached",
      409
    );
  }

  const deviceCode =
    payload?.deviceCode ||
    `fc-${crypto.randomUUID()}`;

  const nextType = payload?.type;
  const nextName = payload?.name;
  const nextCropId = payload?.cropId || null;
  const nextMoistureMin =
    payload?.moistureMinThreshold ?? null;
  const nextMoistureMax =
    payload?.moistureMaxThreshold ?? null;
  const rawDeviceSecret = generateDeviceSecret();
  const deviceSecretHash =
    await hashDeviceSecret(rawDeviceSecret);

  const device = await db.Device.create({
    name: nextName,
    type: nextType,
    deviceCode,
    cropId: nextCropId,
    moistureMinThreshold: nextMoistureMin,
    moistureMaxThreshold: nextMoistureMax,
    isOnline: false,
    userId,
    deviceSecretHash,
  });

  logger.info("Device registered", {
    deviceId: device.id,
    userId,
  });

  const safeDevice = device.toJSON();
  delete safeDevice.deviceSecretHash;

  // Returned once for firmware provisioning.
  safeDevice.deviceSecret = rawDeviceSecret;

  return safeDevice;
};

/**
 * Claim and provision a hardware device to a user.
 * Returns the plaintext device secret exactly once.
 */
const provisionDevice = async (
  userId,
  payload,
  options = {}
) => {
  const correlationId =
    options?.correlationId || null;
  const deviceName = String(
    payload?.deviceName || ""
  ).trim();

  if (!deviceName) {
    await logAuditEvent({
      eventType:
        AUDIT.EVENTS.DEVICE_PROVISION_FAILED,
      actorType: AUDIT.ACTOR_TYPES.USER,
      actorId: userId,
      targetDeviceId: null,
      metadata: {
        reason: "missing_device_name",
      },
      correlationId,
    });

    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "deviceName is required",
      400
    );
  }

  const deviceId =
    await reserveUniqueProvisioningDeviceId();
  const rawDeviceSecret = generateDeviceSecret();
  const deviceSecretHash =
    await hashDeviceSecret(rawDeviceSecret);
  const deviceApiBaseUrl =
    resolveDeviceApiBaseUrl();
  const deviceMqttHost = resolveDeviceMqttHost();

  await db.Device.create({
    name: deviceName,
    type: DEVICE_TYPES.SOIL_SENSOR,
    deviceCode: deviceId,
    isOnline: false,
    userId,
    deviceSecretHash,
  });

  logger.info("Device provisioned", {
    userId,
    deviceId,
    deviceApiBaseUrl,
    deviceMqttHost,
  });

  await logAuditEvent({
    eventType: AUDIT.EVENTS.DEVICE_PROVISIONED,
    actorType: AUDIT.ACTOR_TYPES.USER,
    actorId: userId,
    targetDeviceId: deviceId,
    metadata: {
      deviceName,
    },
    correlationId,
  });

  return {
    deviceId,
    deviceName,
    deviceSecret: rawDeviceSecret,
    deviceApiBaseUrl,
    deviceMqttHost,
  };
};

/**
 * Update device (owner only; status updates require privileged role)
 */
const updateMyDevice = async (
  deviceId,
  userId,
  updates,
  isAdmin = false
) => {
  const device = await getDeviceById(
    deviceId
  );

  assertOwnership(device, userId);

  const sanitized = { ...(updates || {}) };
  const wifiSsid = String(
    sanitized.wifiSsid || ""
  ).trim();
  const wifiPassword =
    typeof sanitized.wifiPassword === "string"
      ? sanitized.wifiPassword
      : "";
  const wifiUpdateRequested =
    wifiSsid.length > 0 || wifiPassword.length > 0;

  if (!isAdmin) {
    delete sanitized.status;
  }

  delete sanitized.wifiSsid;
  delete sanitized.wifiPassword;

  // Connectivity state is system-managed by telemetry/offline monitor.
  delete sanitized.isOnline;

  const hasMetadataUpdates =
    Object.keys(sanitized).length > 0;

  if (!hasMetadataUpdates && !wifiUpdateRequested) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_UPDATE_INVALID,
      "No valid device updates supplied",
      400
    );
  }

  let wifiUpdateResult = null;
  if (wifiUpdateRequested) {
    wifiUpdateResult = await sendWifiCredentialsUpdate(
      device,
      wifiSsid,
      wifiPassword
    );
  }

  if (hasMetadataUpdates) {
    Object.assign(device, sanitized);
    await device.save();
  }

  logger.info("Device updated", {
    deviceId: device.id,
    userId,
    wifiCredentialsUpdated: wifiUpdateRequested,
    wifiCommandPublished:
      wifiUpdateResult?.mqttPublished === true,
  });

  return device;
};

/**
 * Legacy hard delete endpoint is intentionally disabled.
 * Secure deletion requires staged USB-confirmed flow.
 */
const deleteDevice = async () => {
  throw domainError(
    ERROR_CODES.NOT_IMPLEMENTED,
    "Secure deletion requires USB flow: use pre-delete then finalize-delete",
    409
  );
};

/**
 * Stage 1: mark device for secure deletion (owner only).
 */
const preDeleteDevice = async (
  deviceId,
  userId,
  options = {}
) => {
  const correlationId =
    options?.correlationId || null;
  const device = await getDeviceById(
    deviceId
  );

  assertOwnership(device, userId);

  if (device.deletionPending === true) {
    return {
      deviceId: device.id,
      deviceCode: device.deviceCode,
      deletionPending: true,
    };
  }

  await device.update({
    deletionPending: true,
    deletionPendingAt: new Date(),
  });

  await logAuditEvent({
    eventType: AUDIT.EVENTS.DEVICE_DELETE_PREPARED,
    actorType: AUDIT.ACTOR_TYPES.USER,
    actorId: userId,
    targetDeviceId: device.deviceCode,
    metadata: {
      devicePk: device.id,
    },
    correlationId,
  });

  logger.warn("Device deletion prepared", {
    deviceId: device.id,
    userId,
  });

  return {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    deletionPending: true,
  };
};

/**
 * Stage 2: finalize deletion after pre-delete.
 * Ownership binding and secret material are removed.
 * USB reset is optional and can be performed before this call.
 */
const finalizeDeleteDevice = async (
  deviceId,
  userId,
  options = {}
) => {
  const correlationId =
    options?.correlationId || null;
  const device = await getDeviceById(
    deviceId
  );

  assertOwnership(device, userId);

  if (device.deletionPending !== true) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "Device is not in deletion pending state",
      409
    );
  }

  const finalizePayload = {
    userId: null,
    deviceSecretHash: null,
    pendingWifiSsid: null,
    pendingWifiPassword: null,
    pendingWifiRequestedAt: null,
    deletionPending: false,
    deletionPendingAt: null,
    isOnline: false,
    status: "inactive",
    deletedAt: new Date(),
  };

  try {
    await device.update(finalizePayload);
  } catch (error) {
    if (!isMissingPendingWifiColumnError(error)) {
      throw error;
    }

    logger.warn(
      "Pending WiFi columns missing during finalize delete. Run latest migrations.",
      {
        deviceId: device.id,
        deviceCode: device.deviceCode,
      }
    );

    delete finalizePayload.pendingWifiSsid;
    delete finalizePayload.pendingWifiPassword;
    delete finalizePayload.pendingWifiRequestedAt;
    await device.update(finalizePayload);
  }

  await clearRetainedDeviceTopics(
    device.deviceCode
  );

  await logAuditEvent({
    eventType: AUDIT.EVENTS.DEVICE_DELETE_FINALIZED,
    actorType: AUDIT.ACTOR_TYPES.USER,
    actorId: userId,
    targetDeviceId: device.deviceCode,
    metadata: {
      devicePk: device.id,
    },
    correlationId,
  });

  logger.warn("Device deletion finalized", {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    userId,
  });

  return {
    deviceId: device.id,
    finalized: true,
  };
};



/**
 * Fetch live telemetry
 * (stub – real implementation integrates IoT gateway)
 */
const getLiveDeviceData = async (
  deviceId,
  userId
) => {
  const device = await getDeviceById(
    deviceId
  );

  assertOwnership(device, userId);

  const latest = await db.SoilRecord.findOne({
    where: { deviceId: device.id },
    order: [["createdAt", "DESC"]],
  });

  const soilData = latest
    ? {
        soilPh: null,
        soilTemp: toFiniteNumber(
          latest.temperature
        ),
        soilMoisture: toFiniteNumber(
          latest.moisture
        ),
        latitude: toFiniteNumber(latest.latitude),
        longitude: toFiniteNumber(latest.longitude),
        battery: toFiniteNumber(latest.battery),
        sensorQuality: "good",
        measuredAt: latest.createdAt
          ? new Date(latest.createdAt).toISOString()
          : null,
      }
    : null;

  const season = deriveSeasonLabel(
    latest?.createdAt
  );

  const fertilizer = soilData
    ? buildFertilizerRecommendation({
        cropType: null,
        soilType: null,
        season,
        soilPh: soilData.soilPh,
      })
    : null;

  const water = soilData
    ? buildWaterRecommendation({
        cropType: null,
        soilType: null,
        season,
        soilTemp: soilData.soilTemp,
        soilMoisture: soilData.soilMoisture,
      })
    : null;

  return {
    device: {
      id: device.id,
      name: device.name,
      type: device.type,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      latitude: device.latitude,
      longitude: device.longitude,
      deviceCode: device.deviceCode,
    },
    soilData,
    recommendations: {
      fertilizer,
      water,
    },
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Sync device data (manual trigger)
 */
const syncDeviceData = async (
  deviceId,
  userId,
  payload
) => {
  const device = await getDeviceById(
    deviceId
  );

  assertOwnership(device, userId);

  const metrics = payload?.data || {};
  const moisture = toFiniteNumber(metrics.moisture);
  const temperature = toFiniteNumber(metrics.temperature);
  const latitude = toFiniteNumber(
    metrics.latitude !== undefined ? metrics.latitude : metrics.lat
  );
  const longitude = toFiniteNumber(
    metrics.longitude !== undefined ? metrics.longitude : metrics.lng
  );

  if (metrics.gpsValid !== true) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_UPDATE_INVALID,
      "gpsValid must be true",
      400
    );
  }

  if (metrics.soilValid !== true) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_UPDATE_INVALID,
      "soilValid must be true",
      400
    );
  }

  if (
    moisture === null ||
    temperature === null ||
    latitude === null ||
    longitude === null
  ) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_UPDATE_INVALID,
      "Telemetry payload is missing numeric fields",
      400
    );
  }

  if (
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_UPDATE_INVALID,
      "Latitude/longitude out of range",
      400
    );
  }

  if (
    Math.abs(latitude) < 0.000001 &&
    Math.abs(longitude) < 0.000001
  ) {
    throw domainError(
      DEVICE_ERRORS.DEVICE_UPDATE_INVALID,
      "0,0 coordinates are not allowed",
      400
    );
  }

  const record = await db.SoilRecord.create({
    deviceId: device.id,
    userId,
    moisture,
    temperature,
    latitude,
    longitude,
    battery: metrics.battery ?? null,
  });

  device.lastSeenAt = record.createdAt || new Date();
  await device.save();

  logger.info("Device data synced", {
    deviceId: device.id,
    userId,
  });

  // Payload persistence handled in soil/telemetry modules
  return record;
};



module.exports = {
  // User-scoped
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
