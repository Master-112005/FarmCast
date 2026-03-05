"use strict";



/**
 * Supported device categories
 * (Expandable for future hardware)
 */
const DEVICE_TYPES = Object.freeze({
  SOIL_SENSOR: "soil_sensor",
  WEATHER_SENSOR: "weather_sensor",
  MULTI_SENSOR: "multi_sensor",
});



/**
 * Device operational status
 * Used for dashboards & health checks
 */
const DEVICE_STATUS = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
  OFFLINE: "offline",
  MAINTENANCE: "maintenance",
});



/**
 * Ownership rules
 * Enforced via RBAC & service layer
 */
const DEVICE_OWNERSHIP = Object.freeze({
  OWNER: "owner",
});



/**
 * Domain-level limits
 * DB & rate limits live elsewhere
 */
const DEVICE_LIMITS = Object.freeze({
  MAX_NAME_LENGTH: 100,
  MIN_NAME_LENGTH: 2,
  MAX_DEVICES_PER_USER: 50,
});



/**
 * Device-specific error codes
 * Complement global ERROR_CODES
 */
const DEVICE_ERRORS = Object.freeze({
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  DEVICE_ACCESS_DENIED: "DEVICE_ACCESS_DENIED",
  DEVICE_LIMIT_REACHED: "DEVICE_LIMIT_REACHED",
  DEVICE_ALREADY_PROVISIONED: "DEVICE_ALREADY_PROVISIONED",
  DEVICE_ID_INVALID: "DEVICE_ID_INVALID",
  INVALID_DEVICE_TYPE: "INVALID_DEVICE_TYPE",
  DEVICE_UPDATE_INVALID: "DEVICE_UPDATE_INVALID",
});



module.exports = Object.freeze({
  DEVICE_TYPES,
  DEVICE_STATUS,
  DEVICE_OWNERSHIP,
  DEVICE_LIMITS,
  DEVICE_ERRORS,
});
