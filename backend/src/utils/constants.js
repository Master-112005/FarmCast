"use strict";



const APP = Object.freeze({
  NAME: "FarmCast",
  VERSION: "1.0.0",
});



/**
 * Role model (LOCKED)
 *
 * USER:
 * - Full access to own dashboard, profile, devices, data
 *
 * ADMIN:
 * - Everything USER can do for their own account
 * - No implicit override of other users' resources
 */
const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});



const AUTH = Object.freeze({
  TOKEN_TYPE: "Bearer",
  HEADER_NAME: "Authorization",

  // Used only as semantic references (not enforcement)
  PASSWORD_MIN_LENGTH: 8,
});



/**
 * Standardized error codes returned by API
 * Frontend relies on these for safe handling
 */
const ERROR_CODES = Object.freeze({
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  ACCESS_DENIED: "ACCESS_DENIED",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  DUPLICATE_RESOURCE: "DUPLICATE_RESOURCE",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  ML_SERVICE_ERROR: "ML_SERVICE_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});



const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,

  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,

  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
});



/**
 * Must match frontend validation exactly
 */
const UPLOADS = Object.freeze({
  IMAGE: {
    ALLOWED_MIME: [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    MAX_SIZE_MB: 5,
  },
});



const DEVICE = Object.freeze({
  TYPES: Object.freeze({
    SOIL_SENSOR: "soil_sensor",
    WEATHER_SENSOR: "weather_sensor",
    MULTI_SENSOR: "multi_sensor",
  }),
  STATUS: Object.freeze({
    ACTIVE: "active",
    INACTIVE: "inactive",
    OFFLINE: "offline",
    MAINTENANCE: "maintenance",
  }),
});

const SOIL = Object.freeze({
  SOURCE: Object.freeze({
    MANUAL: "manual",
    DEVICE: "device",
  }),
});

const ALERT = Object.freeze({
  TYPES: Object.freeze({
    MOISTURE_LOW: "MOISTURE_LOW",
    MOISTURE_HIGH: "MOISTURE_HIGH",
    DEVICE_OFFLINE: "DEVICE_OFFLINE",
  }),
  DEFAULTS: Object.freeze({
    MOISTURE_MIN_THRESHOLD: 20,
    MOISTURE_MAX_THRESHOLD: null,
    OFFLINE_WINDOW_MINUTES: 10,
    OFFLINE_MONITOR_INTERVAL_MS: 60000,
  }),
});



const PREDICTION = Object.freeze({
  TYPE: Object.freeze({
    YIELD: "yield",
    FERTILIZER: "fertilizer",
    WATER: "water",
    DISEASE: "disease",
  }),

  STATUS: Object.freeze({
    SUCCESS: "success",
    FAILED: "failed",
  }),
});



const LIMITS = Object.freeze({
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
});



const SYSTEM = Object.freeze({
  HEALTH_STATUS: Object.freeze({
    OK: "ok",
    DEGRADED: "degraded",
  }),
});

const AUDIT = Object.freeze({
  ACTOR_TYPES: Object.freeze({
    USER: "user",
    DEVICE: "device",
    SYSTEM: "system",
  }),
  EVENTS: Object.freeze({
    DEVICE_PROVISIONED: "DEVICE_PROVISIONED",
    DEVICE_PROVISION_FAILED: "DEVICE_PROVISION_FAILED",
    DEVICE_AUTH_FAILED: "DEVICE_AUTH_FAILED",
    DEVICE_ONLINE: "DEVICE_ONLINE",
    DEVICE_OFFLINE: "DEVICE_OFFLINE",
    DEVICE_FACTORY_RESET: "DEVICE_FACTORY_RESET",
    DEVICE_DELETE_PREPARED: "DEVICE_DELETE_PREPARED",
    DEVICE_DELETE_FINALIZED: "DEVICE_DELETE_FINALIZED",
  }),
});



module.exports = Object.freeze({
  APP,
  ROLES,
  AUTH,
  ERROR_CODES,
  HTTP_STATUS,
  UPLOADS,
  DEVICE,
  SOIL,
  ALERT,
  PREDICTION,
  LIMITS,
  SYSTEM,
  AUDIT,
});
