"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const db = require("../../models");
const env = require("../../config/env");
const logger = require("../../utils/logger");
const { AUDIT, DEVICE } = require("../../utils/constants");
const {
  logAuditEvent,
} = require("../audit/audit.service");

const MQTT_ACCESS = Object.freeze({
  READ: 1,
  WRITE: 2,
  READ_WRITE: 3,
  SUBSCRIBE: 4,
});

const DEVICE_ID_REGEX = /^fc-[A-Z0-9]{8}$/;
const WILDCARD_TOPIC_PATTERN = /[+#]/;
const DEVICE_SESSION_REVALIDATE_MS = 5000;
const DEVICE_WRITE_TOPIC_REGEX =
  /^devices\/(fc-[A-Z0-9]{8})\/(telemetry|heartbeat)$/;
const DEVICE_RESET_TOPIC_REGEX =
  /^devices\/(fc-[A-Z0-9]{8})\/system\/reset$/;
const DEVICE_OTA_TOPIC_REGEX =
  /^devices\/(fc-[A-Z0-9]{8})\/ota$/;
const DEVICE_WIFI_UPDATE_TOPIC_REGEX =
  /^devices\/(fc-[A-Z0-9]{8})\/wifi\/update$/;

const sessionCache = new Map();

const deviceStatusAllowsMqtt = (status) =>
  status === DEVICE.STATUS.ACTIVE ||
  status === DEVICE.STATUS.OFFLINE;

const loadDeviceSessionState = async (deviceId) => {
  return db.Device.findOne({
    where: { deviceCode: deviceId },
    attributes: [
      "id",
      "deviceCode",
      "userId",
      "status",
    ],
  });
};

const hashValue = (value) =>
  crypto
    .createHash("sha256")
    .update(String(value))
    .digest();

const timingSafeEqualString = (left, right) => {
  const leftDigest = hashValue(left);
  const rightDigest = hashValue(right);
  return crypto.timingSafeEqual(leftDigest, rightDigest);
};

const normalizeClientId = (value) =>
  typeof value === "string" && value.trim()
    ? value.trim()
    : "__no_clientid__";

const buildSessionKey = (username, clientId) =>
  `${username}:${normalizeClientId(clientId)}`;

const parseAccess = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : 0;
};

const isDeviceTokenPayload = (payload) => {
  return (
    payload &&
    payload.sub === "device" &&
    payload.type === "device" &&
    typeof payload.deviceId === "string" &&
    DEVICE_ID_REGEX.test(payload.deviceId) &&
    typeof payload.userId === "string" &&
    payload.userId.length > 0
  );
};

const isInternalBrokerUser = ({
  username,
  password,
}) => {
  if (
    !env.MQTT.CLIENT_USERNAME ||
    !env.MQTT.CLIENT_PASSWORD
  ) {
    return false;
  }

  return (
    timingSafeEqualString(
      username,
      env.MQTT.CLIENT_USERNAME
    ) &&
    timingSafeEqualString(
      password,
      env.MQTT.CLIENT_PASSWORD
    )
  );
};

const verifyDeviceJwt = (token) => {
  return jwt.verify(token, env.DEVICE_AUTH.JWT_SECRET, {
    issuer: env.DEVICE_AUTH.JWT_ISSUER,
    audience: env.DEVICE_AUTH.JWT_AUDIENCE,
    algorithms: [env.DEVICE_AUTH.JWT_ALGORITHM],
    clockTolerance: 60,
  });
};

const recordSecurityViolation = async ({
  reason,
  check,
  username,
  clientid,
  topic = null,
  targetDeviceId = null,
}) => {
  logger.warn("MQTT security violation", {
    reason,
    check,
    username,
    clientid: normalizeClientId(clientid),
    topic,
    targetDeviceId,
  });

  await logAuditEvent({
    eventType: AUDIT.EVENTS.DEVICE_AUTH_FAILED,
    actorType: AUDIT.ACTOR_TYPES.DEVICE,
    actorId: username || null,
    targetDeviceId:
      targetDeviceId || username || null,
    metadata: {
      reason,
      check,
      topic,
      clientid: normalizeClientId(clientid),
    },
  });
};

const sessionExpired = (session) => {
  if (!session?.expAtMs) return false;
  return Date.now() >= session.expAtMs;
};

const saveSession = ({
  username,
  clientid,
  session,
}) => {
  const key = buildSessionKey(username, clientid);
  sessionCache.set(key, session);
};

const getSession = ({ username, clientid }) => {
  const key = buildSessionKey(username, clientid);
  const session = sessionCache.get(key);

  if (!session) return null;
  if (!sessionExpired(session)) return session;

  sessionCache.delete(key);
  return null;
};

const ensureDeviceSessionAuthorized = async ({
  session,
  username,
  clientid,
  topic = null,
  check = "acl",
}) => {
  if (session.role !== "device") {
    return true;
  }

  if (session.revoked === true) {
    return false;
  }

  const now = Date.now();
  if (
    Number.isFinite(session.lastDeviceCheckMs) &&
    now - session.lastDeviceCheckMs <
      DEVICE_SESSION_REVALIDATE_MS
  ) {
    return true;
  }

  const device = await loadDeviceSessionState(
    session.deviceId
  );

  const stillAuthorized =
    !!device &&
    typeof device.userId === "string" &&
    device.userId === session.userId &&
    deviceStatusAllowsMqtt(device.status);

  if (!stillAuthorized) {
    await recordSecurityViolation({
      reason: "device_revoked_or_missing",
      check,
      username,
      clientid,
      topic,
      targetDeviceId: session.deviceId,
    });

    session.revoked = true;
    session.revokedAtMs = now;
    saveSession({
      username,
      clientid,
      session,
    });

    return false;
  }

  session.lastDeviceCheckMs = now;
  saveSession({
    username,
    clientid,
    session,
  });

  return true;
};

const extractTopicDeviceId = (topic) => {
  const writeMatch = String(topic || "").match(
    DEVICE_WRITE_TOPIC_REGEX
  );
  if (writeMatch) {
    return {
      deviceId: writeMatch[1],
      direction: "write",
    };
  }

  const resetMatch = String(topic || "").match(
    DEVICE_RESET_TOPIC_REGEX
  );
  if (resetMatch) {
    return {
      deviceId: resetMatch[1],
      direction: "write",
    };
  }

  const otaMatch = String(topic || "").match(
    DEVICE_OTA_TOPIC_REGEX
  );
  if (otaMatch) {
    return {
      deviceId: otaMatch[1],
      direction: "read",
    };
  }

  const wifiUpdateMatch = String(topic || "").match(
    DEVICE_WIFI_UPDATE_TOPIC_REGEX
  );
  if (wifiUpdateMatch) {
    return {
      deviceId: wifiUpdateMatch[1],
      direction: "read",
    };
  }

  return null;
};

const validateDeviceAcl = async ({
  session,
  topic,
  access,
  username,
  clientid,
}) => {
  const normalizedTopic = String(topic || "").trim();

  if (WILDCARD_TOPIC_PATTERN.test(normalizedTopic)) {
    await recordSecurityViolation({
      reason: "wildcard_topic_denied",
      check: "acl",
      username,
      clientid,
      topic: normalizedTopic,
      targetDeviceId: session.deviceId,
    });
    return false;
  }

  const parsed = extractTopicDeviceId(normalizedTopic);
  if (!parsed) {
    await recordSecurityViolation({
      reason: "invalid_topic_format",
      check: "acl",
      username,
      clientid,
      topic: normalizedTopic,
      targetDeviceId: session.deviceId,
    });
    return false;
  }

  if (
    !timingSafeEqualString(
      parsed.deviceId,
      session.deviceId
    )
  ) {
    await recordSecurityViolation({
      reason: "cross_device_topic_denied",
      check: "acl",
      username,
      clientid,
      topic: normalizedTopic,
      targetDeviceId: parsed.deviceId,
    });
    return false;
  }

  if (
    parsed.direction === "write" &&
    (access === MQTT_ACCESS.WRITE ||
      access === MQTT_ACCESS.READ_WRITE)
  ) {
    return true;
  }

  if (
    parsed.direction === "read" &&
    (access === MQTT_ACCESS.READ ||
      access === MQTT_ACCESS.READ_WRITE ||
      access === MQTT_ACCESS.SUBSCRIBE)
  ) {
    return true;
  }

  await recordSecurityViolation({
    reason: "acl_access_denied",
    check: "acl",
    username,
    clientid,
    topic: normalizedTopic,
    targetDeviceId: parsed.deviceId,
  });
  return false;
};

const handleConnectAuth = async ({
  username,
  password,
  clientid,
}) => {
  if (
    typeof password !== "string" ||
    password.length === 0
  ) {
    await recordSecurityViolation({
      reason: "missing_password",
      check: "connect",
      username,
      clientid,
    });
    return { allowed: false };
  }

  if (isInternalBrokerUser({ username, password })) {
    saveSession({
      username,
      clientid,
      session: {
        role: "internal_broker",
      },
    });
    return { allowed: true };
  }

  let payload = null;
  try {
    payload = verifyDeviceJwt(password);
  } catch (error) {
    await recordSecurityViolation({
      reason:
        error?.name === "TokenExpiredError"
          ? "jwt_expired"
          : "jwt_invalid",
      check: "connect",
      username,
      clientid,
      targetDeviceId: username || null,
    });
    return { allowed: false };
  }

  if (!isDeviceTokenPayload(payload)) {
    await recordSecurityViolation({
      reason: "jwt_payload_invalid",
      check: "connect",
      username,
      clientid,
      targetDeviceId: username || null,
    });
    return { allowed: false };
  }

  if (
    !timingSafeEqualString(
      payload.deviceId,
      username
    )
  ) {
    await recordSecurityViolation({
      reason: "jwt_username_mismatch",
      check: "connect",
      username,
      clientid,
      targetDeviceId: payload.deviceId,
    });
    return { allowed: false };
  }

  const device = await loadDeviceSessionState(
    payload.deviceId
  );
  const deviceAuthorized =
    !!device &&
    typeof device.userId === "string" &&
    device.userId === payload.userId &&
    deviceStatusAllowsMqtt(device.status);

  if (!deviceAuthorized) {
    await recordSecurityViolation({
      reason: "device_revoked_or_missing",
      check: "connect",
      username,
      clientid,
      targetDeviceId: payload.deviceId,
    });
    return { allowed: false };
  }

  const expAtMs = payload.exp
    ? payload.exp * 1000
    : 0;

  if (expAtMs && Date.now() >= expAtMs) {
    await recordSecurityViolation({
      reason: "jwt_expired",
      check: "connect",
      username,
      clientid,
      targetDeviceId: payload.deviceId,
    });
    return { allowed: false };
  }

  saveSession({
    username,
    clientid,
    session: {
      role: "device",
      userId: payload.userId,
      deviceId: payload.deviceId,
      expAtMs,
      lastDeviceCheckMs: Date.now(),
      revoked: false,
    },
  });

  return { allowed: true };
};

const handleSuperuserCheck = async ({
  username,
  clientid,
}) => {
  const session = getSession({ username, clientid });
  if (!session) {
    return { allowed: false };
  }

  return {
    allowed: session.role === "internal_broker",
  };
};

const handleAclCheck = async ({
  username,
  clientid,
  topic,
  acc,
}) => {
  const session = getSession({ username, clientid });
  if (!session) {
    await recordSecurityViolation({
      reason: "session_missing_or_expired",
      check: "acl",
      username,
      clientid,
      topic,
    });
    return { allowed: false };
  }

  if (session.role === "internal_broker") {
    return { allowed: true };
  }

  const sessionAuthorized =
    await ensureDeviceSessionAuthorized({
      session,
      username,
      clientid,
      topic,
      check: "acl",
    });

  if (!sessionAuthorized) {
    return { allowed: false };
  }

  const access = parseAccess(acc);
  if (!access) {
    await recordSecurityViolation({
      reason: "access_code_invalid",
      check: "acl",
      username,
      clientid,
      topic,
      targetDeviceId: session.deviceId,
    });
    return { allowed: false };
  }

  const allowed = await validateDeviceAcl({
    session,
    topic,
    access,
    username,
    clientid,
  });

  return { allowed };
};

const evaluateMqttValidation = async (payload) => {
  const username = String(
    payload?.username ||
      payload?.user ||
      ""
  ).trim();
  const clientid =
    payload?.clientid || payload?.clientId || "";
  const passwordProvided =
    Object.prototype.hasOwnProperty.call(
      payload,
      "password"
    ) ||
    Object.prototype.hasOwnProperty.call(
      payload,
      "pass"
    );
  const password =
    Object.prototype.hasOwnProperty.call(
      payload,
      "password"
    )
      ? payload.password
      : payload?.pass;

  if (
    Object.prototype.hasOwnProperty.call(payload, "topic") ||
    Object.prototype.hasOwnProperty.call(payload, "acc") ||
    Object.prototype.hasOwnProperty.call(payload, "access")
  ) {
    const result = await handleAclCheck({
      username,
      clientid,
      topic: payload.topic,
      acc:
        payload.acc !== undefined
          ? payload.acc
          : payload.access,
    });

    logger.info("MQTT broker auth check", {
      check: "acl",
      username,
      allowed: result.allowed,
      topic: payload.topic || null,
      acc:
        payload.acc !== undefined
          ? payload.acc
          : payload.access ?? null,
    });

    return result;
  }

  if (passwordProvided) {
    const result = await handleConnectAuth({
      username,
      password: String(password || ""),
      clientid,
    });

    logger.info("MQTT broker auth check", {
      check: "connect",
      username,
      allowed: result.allowed,
    });

    return result;
  }

  const result = await handleSuperuserCheck({
    username,
    clientid,
  });

  logger.info("MQTT broker auth check", {
    check: "superuser",
    username,
    allowed: result.allowed,
  });

  return result;
};

module.exports = Object.freeze({
  evaluateMqttValidation,
});
