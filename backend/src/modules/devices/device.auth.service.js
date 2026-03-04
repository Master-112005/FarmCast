/**
 * src/modules/devices/device.auth.service.js
 * ------------------------------------------------------
 * Device Authentication Service
 *
 * Responsibilities:
 * - Verify device credentials safely
 * - Enforce device lifecycle auth policy
 * - Issue short-lived device JWTs
 *
 * Rules:
 * - NO Express req/res
 * - NO plaintext secret storage
 * - NO user JWT secret reuse
 */

"use strict";

const crypto = require("crypto");
const { Op } = require("sequelize");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const db = require("../../models");
const env = require("../../config/env");
const logger = require("../../utils/logger");
const {
  DEVICE,
  ERROR_CODES,
  HTTP_STATUS,
  AUTH,
  AUDIT,
} = require("../../utils/constants");
const {
  logAuditEvent,
} = require("../audit/audit.service");

const DUMMY_BCRYPT_HASH =
  "$2b$12$SbxItqel9fx9UFOJdGyFfeKtI5kHFtMY4RiizNHezwbdrv6T8mqoy";

const BCRYPT_ROUNDS = 12;
const INVALID_CREDENTIALS_MESSAGE =
  "Invalid credentials";

const DEVICE_STATUS_ALLOWED_FOR_AUTH =
  Object.freeze([
    DEVICE.STATUS.ACTIVE,
    DEVICE.STATUS.OFFLINE,
  ]);
const DEVICE_CODE_REGEX = /^fc-[A-Z0-9]{8}$/;

const domainError = (
  code,
  message,
  status = HTTP_STATUS.BAD_REQUEST
) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const assertNonEmptyString = (value, label) => {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new TypeError(
      `${label} must be a non-empty string`
    );
  }
};

const parseExpiryToSeconds = (value) => {
  if (typeof value === "number" && value > 0) {
    return Math.floor(value);
  }

  if (typeof value !== "string") {
    return 3600;
  }

  const normalized = value.trim().toLowerCase();
  const match =
    normalized.match(/^(\d+)([smhd]?)$/);

  if (!match) {
    return 3600;
  }

  const amount = Number(match[1]);
  const unit = match[2] || "s";

  if (!Number.isFinite(amount) || amount <= 0) {
    return 3600;
  }

  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 3600;
  if (unit === "d") return amount * 86400;
  return amount;
};

const normalizePendingWifiUpdate = (device) => {
  const ssid = String(
    device?.pendingWifiSsid || ""
  ).trim();
  const password = String(
    device?.pendingWifiPassword || ""
  );

  if (!ssid || !password) {
    return null;
  }

  return {
    ssid,
    password,
    requestedAt: device?.pendingWifiRequestedAt
      ? new Date(
          device.pendingWifiRequestedAt
        ).toISOString()
      : new Date().toISOString(),
  };
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

const loadDeviceForAuth = async (
  normalizedDeviceId
) => {
  const baseAttributes = [
    "id",
    "deviceCode",
    "userId",
    "status",
    "deviceSecretHash",
  ];
  const pendingAttributes = [
    "pendingWifiSsid",
    "pendingWifiPassword",
    "pendingWifiRequestedAt",
  ];

  try {
    return await db.Device.findOne({
      where: {
        [Op.or]: [
          { id: normalizedDeviceId },
          { deviceCode: normalizedDeviceId },
        ],
      },
      attributes: [
        ...baseAttributes,
        ...pendingAttributes,
      ],
    });
  } catch (error) {
    if (!isMissingPendingWifiColumnError(error)) {
      throw error;
    }

    logger.warn(
      "Pending WiFi columns missing during auth. Run latest migrations."
    );

    return db.Device.findOne({
      where: {
        [Op.or]: [
          { id: normalizedDeviceId },
          { deviceCode: normalizedDeviceId },
        ],
      },
      attributes: baseAttributes,
    });
  }
};

const generateDeviceSecret = () =>
  crypto.randomBytes(32).toString("hex");

const hashDeviceSecret = async (deviceSecret) => {
  assertNonEmptyString(deviceSecret, "Device secret");
  return bcrypt.hash(deviceSecret, BCRYPT_ROUNDS);
};

const verifyBcryptConstantTime = async (
  plainValue,
  bcryptHash
) => {
  try {
    const recomputed = await bcrypt.hash(
      plainValue,
      bcryptHash
    );

    const left = Buffer.from(recomputed, "utf8");
    const right = Buffer.from(bcryptHash, "utf8");

    if (left.length !== right.length) {
      return false;
    }

    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
};

const verifyDeviceSecret = async (
  plainSecret,
  storedHash
) => {
  assertNonEmptyString(plainSecret, "Device secret");

  const hasStoredBcryptHash =
    typeof storedHash === "string" &&
    /^\$2[aby]\$\d+\$/.test(storedHash);

  // Always run a hash verification path to flatten timing.
  const comparisonHash = hasStoredBcryptHash
    ? storedHash
    : DUMMY_BCRYPT_HASH;

  const matches = await verifyBcryptConstantTime(
    plainSecret,
    comparisonHash
  );

  if (!hasStoredBcryptHash) {
    return false;
  }

  return matches;
};

const signDeviceToken = (device, authDeviceId) => {
  const payload = {
    sub: "device",
    deviceId: authDeviceId,
    userId: device.userId,
    type: "device",
  };

  return jwt.sign(
    payload,
    env.DEVICE_AUTH.JWT_SECRET,
    {
      expiresIn: env.DEVICE_AUTH.JWT_EXPIRES_IN,
      issuer: env.DEVICE_AUTH.JWT_ISSUER,
      audience: env.DEVICE_AUTH.JWT_AUDIENCE,
      algorithm: env.DEVICE_AUTH.JWT_ALGORITHM,
    }
  );
};

const authenticateDevice = async (
  { deviceId, deviceSecret },
  options = {}
) => {
  assertNonEmptyString(deviceId, "deviceId");
  assertNonEmptyString(deviceSecret, "deviceSecret");
  const correlationId =
    options?.correlationId || null;
  const normalizedDeviceId = deviceId.trim();

  const device = await loadDeviceForAuth(
    normalizedDeviceId
  );

  const secretValid = await verifyDeviceSecret(
    deviceSecret,
    device?.deviceSecretHash
  );

  const deviceStatusAllowed =
    !!device &&
    DEVICE_STATUS_ALLOWED_FOR_AUTH.includes(
      device.status
    );
  const deviceOwnedByUser =
    !!device &&
    typeof device.userId === "string" &&
    device.userId.trim().length > 0;
  const canonicalDeviceId =
    typeof device?.deviceCode === "string"
      ? device.deviceCode.trim()
      : "";
  const canonicalDeviceIdValid =
    DEVICE_CODE_REGEX.test(canonicalDeviceId);

  if (
    !device ||
    !secretValid ||
    !deviceStatusAllowed ||
    !deviceOwnedByUser ||
    !canonicalDeviceIdValid
  ) {
    logger.warn("Device authentication rejected", {
      deviceId: normalizedDeviceId,
      reason: "invalid_credentials",
    });

    await logAuditEvent({
      eventType: AUDIT.EVENTS.DEVICE_AUTH_FAILED,
      actorType: AUDIT.ACTOR_TYPES.DEVICE,
      actorId:
        canonicalDeviceId || normalizedDeviceId,
      targetDeviceId:
        canonicalDeviceId || normalizedDeviceId,
      metadata: {
        reason: "invalid_credentials",
      },
      correlationId,
    });

    throw domainError(
      ERROR_CODES.AUTH_REQUIRED,
      INVALID_CREDENTIALS_MESSAGE,
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const accessToken = signDeviceToken(
    device,
    canonicalDeviceId
  );
  const expiresIn = parseExpiryToSeconds(
    env.DEVICE_AUTH.JWT_EXPIRES_IN
  );

  // Mark as recently online at auth time so onboarding status checks
  // can confirm cloud reachability even before first MQTT telemetry.
  try {
    await db.Device.update(
      {
        isOnline: true,
        lastSeenAt: new Date(),
      },
      {
        where: { id: device.id },
      }
    );
  } catch (err) {
    logger.warn("Device auth online-state update failed", {
      deviceId: canonicalDeviceId,
      devicePk: device.id,
      message: err?.message || "unknown_error",
    });
  }

  logger.info("Device authenticated", {
    deviceId: canonicalDeviceId,
    devicePk: device.id,
    userId: device.userId,
    tokenType: AUTH.TOKEN_TYPE,
    expiresIn,
  });

  const pendingWifiUpdate =
    normalizePendingWifiUpdate(device);

  return {
    accessToken,
    expiresIn,
    tokenType: AUTH.TOKEN_TYPE,
    wifiUpdate: pendingWifiUpdate,
  };
};

module.exports = Object.freeze({
  authenticateDevice,
  generateDeviceSecret,
  hashDeviceSecret,
  verifyDeviceSecret,
});
