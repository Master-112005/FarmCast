"use strict";

const db = require("../../models");
const logger = require("../../utils/logger");

const SENSITIVE_KEY_PATTERN =
  /(secret|token|password|jwt)/i;

const sanitizeMetadata = (metadata) => {
  if (
    !metadata ||
    typeof metadata !== "object" ||
    Array.isArray(metadata)
  ) {
    return null;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(
    metadata
  )) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      sanitized[key] = sanitizeMetadata(value);
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[key] = value.map((entry) =>
        typeof entry === "object"
          ? sanitizeMetadata(entry)
          : entry
      );
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
};

const logAuditEvent = async ({
  eventType,
  actorType,
  actorId = null,
  targetDeviceId = null,
  metadata = null,
  correlationId = null,
}) => {
  try {
    if (!db?.AuditLog) {
      return null;
    }

    const sanitizedMetadata = sanitizeMetadata(
      metadata
    );
    const nextMetadata =
      correlationId && correlationId.trim()
        ? {
            ...(sanitizedMetadata || {}),
            correlationId: correlationId.trim(),
          }
        : sanitizedMetadata;

    const row = await db.AuditLog.create({
      eventType,
      actorType,
      actorId:
        actorId === null ||
        actorId === undefined
          ? null
          : String(actorId),
      targetDeviceId:
        targetDeviceId === null ||
        targetDeviceId === undefined
          ? null
          : String(targetDeviceId),
      metadata: nextMetadata,
      timestamp: new Date(),
    });

    logger.info("Audit event recorded", {
      eventType,
      actorType,
      actorId:
        actorId === null ||
        actorId === undefined
          ? null
          : String(actorId),
      targetDeviceId:
        targetDeviceId === null ||
        targetDeviceId === undefined
          ? null
          : String(targetDeviceId),
      correlationId:
        correlationId && correlationId.trim()
          ? correlationId.trim()
          : null,
    });

    return row;
  } catch (error) {
    logger.error("Audit event write failed", {
      eventType,
      actorType,
      message: error.message,
    });
    return null;
  }
};

module.exports = Object.freeze({
  logAuditEvent,
});
