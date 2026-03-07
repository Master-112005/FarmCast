"use strict";

const path = require("path");
const dotenv = require("dotenv");



dotenv.config({
  path: path.resolve(process.cwd(), ".env"),
});



const crash = (msg) => {
  console.error(`ENV ERROR: ${msg}`);
  process.exit(1);
};

const required = (key) => {
  const value = process.env[key];
  if (value === undefined || value === "") {
    crash(`Missing required variable "${key}"`);
  }
  return value;
};

const optional = (key, def) => {
  const value = process.env[key];
  return value !== undefined && value !== ""
    ? value
    : def;
};

const toBoolean = (value, def = false) => {
  if (value === undefined) return def;
  return value === "true" || value === "1";
};

const toNumber = (value, def) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : def;
};

const assertMinLength = (value, len, key) => {
  if (value.length < len) {
    crash(
      `"${key}" must be at least ${len} characters`
    );
  }
};

const isPlaceholder = (value) =>
  typeof value === "string" &&
  value.toUpperCase().includes("CHANGE_ME");

const assertNotPlaceholder = (value, key) => {
  if (isPlaceholder(value)) {
    crash(
      `"${key}" must be set to a non-placeholder value`
    );
  }
};



const NODE_ENV = optional(
  "NODE_ENV",
  "development"
);

if (
  !["development", "production", "test"].includes(
    NODE_ENV
  )
) {
  crash(`Invalid NODE_ENV "${NODE_ENV}"`);
}



const env = {
  NODE_ENV,
  PORT: toNumber(optional("PORT", 5000), 5000),
  APP_BASE_URL: required("APP_BASE_URL"),

  API_VERSION: optional("API_VERSION", "v1"),
  HEALTH_ROUTE: optional(
    "HEALTH_ROUTE",
    "/health"
  ),

  DB: {
    DIALECT: required("DB_DIALECT"),
    HOST: required("DB_HOST"),
    PORT: toNumber(optional("DB_PORT", 3306), 3306),
    NAME: required("DB_NAME"),
    USER: required("DB_USER"),
    PASSWORD: required("DB_PASSWORD"),

    POOL: {
      MAX: toNumber(optional("DB_POOL_MAX", 10), 10),
      MIN: toNumber(optional("DB_POOL_MIN", 0), 0),
      ACQUIRE: toNumber(
        optional("DB_POOL_ACQUIRE", 30000),
        30000
      ),
      IDLE: toNumber(
        optional("DB_POOL_IDLE", 10000),
        10000
      ),
    },
  },

  AUTH: {
    JWT_SECRET: required("JWT_SECRET"),
    JWT_EXPIRES_IN: optional(
      "JWT_EXPIRES_IN",
      "1h"
    ),
    REFRESH_TOKEN_EXPIRES_IN: optional(
      "REFRESH_TOKEN_EXPIRES_IN",
      "7d"
    ),
    JWT_ISSUER: optional("JWT_ISSUER", "farmcast"),
    JWT_AUDIENCE: optional(
      "JWT_AUDIENCE",
      "farmcast-users"
    ),
    JWT_ALGORITHM: optional(
      "JWT_ALGORITHM",
      "HS256"
    ),
    REFRESH_TOKEN_SECRET: optional(
      "REFRESH_TOKEN_SECRET",
      optional("JWT_SECRET", "")
    ),
  },

  DEVICE_AUTH: {
    JWT_SECRET: required("DEVICE_JWT_SECRET"),
    JWT_EXPIRES_IN: optional(
      "DEVICE_JWT_EXPIRY",
      "1h"
    ),
    JWT_ISSUER: optional(
      "DEVICE_JWT_ISSUER",
      "farmcast-device"
    ),
    JWT_AUDIENCE: optional(
      "DEVICE_JWT_AUDIENCE",
      "farmcast-devices"
    ),
    JWT_ALGORITHM: optional(
      "DEVICE_JWT_ALGORITHM",
      "HS256"
    ),
    RATE_LIMIT_WINDOW_MS: toNumber(
      optional(
        "DEVICE_AUTH_RATE_LIMIT_WINDOW_MS",
        900000
      ),
      900000
    ),
    RATE_LIMIT_MAX: toNumber(
      optional(
        "DEVICE_AUTH_RATE_LIMIT_MAX",
        20
      ),
      20
    ),
  },

  MQTT: {
    BROKER_URL: optional(
      "MQTT_BROKER_URL",
      "mqtt://localhost:2883"
    ),
    CLIENT_USERNAME: optional(
      "MQTT_CLIENT_USERNAME",
      "backend-collector"
    ),
    CLIENT_PASSWORD: optional(
      "MQTT_CLIENT_PASSWORD",
      ""
    ),
    CLIENT_ID: optional(
      "MQTT_CLIENT_ID",
      "farmcast-backend-subscriber"
    ),
  },

  MQTT_AUTH: {
    RATE_LIMIT_WINDOW_MS: toNumber(
      optional(
        "MQTT_AUTH_RATE_LIMIT_WINDOW_MS",
        60000
      ),
      60000
    ),
    RATE_LIMIT_MAX: toNumber(
      optional("MQTT_AUTH_RATE_LIMIT_MAX", 20000),
      20000
    ),
  },

  SECURITY: {
    RATE_LIMIT_ENABLED: toBoolean(
      optional("RATE_LIMIT_ENABLED", "true"),
      true
    ),
    RATE_LIMIT_MAX: toNumber(
      optional("RATE_LIMIT_MAX", 100),
      100
    ),
    RATE_LIMIT_WINDOW_MS: toNumber(
      optional("RATE_LIMIT_WINDOW_MS", 900000),
      900000
    ),
    RATE_LIMIT_POLLING_MAX: toNumber(
      optional(
        "RATE_LIMIT_POLLING_MAX",
        1200
      ),
      1200
    ),
  },

  CORS: {
    ORIGIN: required("CORS_ORIGIN"),
    CREDENTIALS: toBoolean(
      optional("CORS_CREDENTIALS", "false"),
      false
    ),
  },

  UPLOADS: {
    DIR: optional("UPLOAD_DIR", "uploads"),
    MAX_SIZE_MB: toNumber(
      optional("UPLOAD_MAX_SIZE_MB", 5),
      5
    ),
    ALLOWED_MIME: optional(
      "UPLOAD_ALLOWED_MIME",
      "image/jpeg,image/png,image/webp"
    )
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  },

  LOGGING: {
    LEVEL: optional("LOG_LEVEL", "info"),
    HTTP_LOGGING_ENABLED: toBoolean(
      optional(
        "HTTP_LOGGING_ENABLED",
        "true"
      ),
      true
    ),
  },

  ML: {
    BASE_URL: optional(
      "ML_SERVICE_URL",
      "http://localhost:8000"
    ),
    AUTH_MODE: optional(
      "ML_SERVICE_AUTH_MODE",
      "api_key"
    ),
    API_KEY: optional("ML_SERVICE_API_KEY", ""),
    JWT_SECRET: optional(
      "ML_SERVICE_JWT_SECRET",
      optional("JWT_SECRET", "")
    ),
    JWT_ISSUER: optional(
      "ML_SERVICE_JWT_ISSUER",
      optional("JWT_ISSUER", "farmcast")
    ),
    JWT_AUDIENCE: optional(
      "ML_SERVICE_JWT_AUDIENCE",
      optional("JWT_AUDIENCE", "farmcast-users")
    ),
    JWT_ALGORITHM: optional(
      "ML_SERVICE_JWT_ALGORITHM",
      optional("JWT_ALGORITHM", "HS256")
    ),
    TIMEOUT_MS: toNumber(
      optional("ML_SERVICE_TIMEOUT_MS", 10000),
      10000
    ),
  },

  ADMIN: {
    EMAIL: optional("ADMIN_EMAIL", ""),
    NAME: optional("ADMIN_NAME", "Administrator"),
  },

  MAIL: {
    ENABLED: toBoolean(
      optional("MAIL_ENABLED", "false"),
      false
    ),
    SMTP_HOST: optional("SMTP_HOST", ""),
    SMTP_PORT: toNumber(
      optional("SMTP_PORT", 587),
      587
    ),
    SMTP_SECURE: toBoolean(
      optional("SMTP_SECURE", "false"),
      false
    ),
    SMTP_USER: optional("SMTP_USER", ""),
    SMTP_PASS: optional("SMTP_PASS", ""),
    FROM: optional(
      "SMTP_FROM",
      optional("ADMIN_EMAIL", "")
    ),
    FROM_NAME: optional(
      "SMTP_FROM_NAME",
      optional("ADMIN_NAME", "FarmCast Admin")
    ),
    REPLY_TO: optional("SMTP_REPLY_TO", ""),
  },

  PREDICTION_HISTORY: {
    CLEANUP_ENABLED: toBoolean(
      optional(
        "PREDICTION_HISTORY_CLEANUP_ENABLED",
        "true"
      ),
      true
    ),
    RETENTION_DAYS: toNumber(
      optional(
        "PREDICTION_HISTORY_RETENTION_DAYS",
        2
      ),
      2
    ),
    CLEANUP_INTERVAL_MS: toNumber(
      optional(
        "PREDICTION_HISTORY_CLEANUP_INTERVAL_MS",
        3600000
      ),
      3600000
    ),
    MAX_DELETE_PER_RUN: toNumber(
      optional(
        "PREDICTION_HISTORY_CLEANUP_MAX_DELETE",
        2000
      ),
      2000
    ),
  },

  COMMUNITY: {
    CLEANUP_ENABLED: toBoolean(
      optional(
        "COMMUNITY_CLEANUP_ENABLED",
        "true"
      ),
      true
    ),
    RETENTION_DAYS: toNumber(
      optional(
        "COMMUNITY_RETENTION_DAYS",
        7
      ),
      7
    ),
    CLEANUP_INTERVAL_MS: toNumber(
      optional(
        "COMMUNITY_CLEANUP_INTERVAL_MS",
        3600000
      ),
      3600000
    ),
    MAX_DELETE_PER_RUN: toNumber(
      optional(
        "COMMUNITY_CLEANUP_MAX_DELETE",
        500
      ),
      500
    ),
  },
};



assertMinLength(env.AUTH.JWT_SECRET, 32, "JWT_SECRET");
assertMinLength(
  env.AUTH.REFRESH_TOKEN_SECRET,
  32,
  "REFRESH_TOKEN_SECRET"
);
assertMinLength(
  env.DEVICE_AUTH.JWT_SECRET,
  32,
  "DEVICE_JWT_SECRET"
);

if (
  env.DEVICE_AUTH.JWT_SECRET === env.AUTH.JWT_SECRET
) {
  crash(
    `"DEVICE_JWT_SECRET" must be different from "JWT_SECRET"`
  );
}

if (
  !["api_key", "jwt"].includes(env.ML.AUTH_MODE)
) {
  crash(
    `ML_SERVICE_AUTH_MODE must be "api_key" or "jwt"`
  );
}

if (env.NODE_ENV === "production") {
  assertNotPlaceholder(env.AUTH.JWT_SECRET, "JWT_SECRET");
  assertNotPlaceholder(
    env.AUTH.REFRESH_TOKEN_SECRET,
    "REFRESH_TOKEN_SECRET"
  );
  assertNotPlaceholder(
    env.DEVICE_AUTH.JWT_SECRET,
    "DEVICE_JWT_SECRET"
  );

  if (isPlaceholder(env.DB.PASSWORD)) {
    crash(
      `"DB_PASSWORD" must be set to a non-placeholder value`
    );
  }

  if (env.ML.AUTH_MODE === "api_key") {
    assertNotPlaceholder(
      env.ML.API_KEY,
      "ML_SERVICE_API_KEY"
    );
  }

  if (env.ML.AUTH_MODE === "jwt") {
    assertNotPlaceholder(
      env.ML.JWT_SECRET,
      "ML_SERVICE_JWT_SECRET"
    );
  }
}

if (
  env.NODE_ENV === "production" &&
  env.ML.AUTH_MODE === "api_key" &&
  !env.ML.API_KEY
) {
  crash(
    "ML_SERVICE_API_KEY is required in production when ML_SERVICE_AUTH_MODE=api_key"
  );
}

if (
  env.ML.AUTH_MODE === "jwt" &&
  env.ML.JWT_SECRET
) {
  assertMinLength(
    env.ML.JWT_SECRET,
    32,
    "ML_SERVICE_JWT_SECRET"
  );
}

if (
  env.NODE_ENV === "production" &&
  env.MAIL?.ENABLED
) {
  if (!env.MAIL.SMTP_HOST) {
    crash("SMTP_HOST must be set when MAIL_ENABLED=true");
  }
  if (isPlaceholder(env.MAIL.SMTP_HOST)) {
    crash("SMTP_HOST must not be a placeholder value");
  }
  if (!env.MAIL.SMTP_USER) {
    crash("SMTP_USER must be set when MAIL_ENABLED=true");
  }
  if (isPlaceholder(env.MAIL.SMTP_USER)) {
    crash("SMTP_USER must not be a placeholder value");
  }
  if (!env.MAIL.SMTP_PASS) {
    crash("SMTP_PASS must be set when MAIL_ENABLED=true");
  }
  if (isPlaceholder(env.MAIL.SMTP_PASS)) {
    crash("SMTP_PASS must not be a placeholder value");
  }
  if (!env.MAIL.FROM) {
    crash(
      "SMTP_FROM or ADMIN_EMAIL must be set when MAIL_ENABLED=true"
    );
  }
}

if (
  env.PREDICTION_HISTORY.RETENTION_DAYS < 1
) {
  crash(
    "PREDICTION_HISTORY_RETENTION_DAYS must be at least 1"
  );
}

if (
  env.PREDICTION_HISTORY.CLEANUP_INTERVAL_MS <
  60000
) {
  crash(
    "PREDICTION_HISTORY_CLEANUP_INTERVAL_MS must be at least 60000"
  );
}

if (
  env.PREDICTION_HISTORY.MAX_DELETE_PER_RUN <
  1
) {
  crash(
    "PREDICTION_HISTORY_CLEANUP_MAX_DELETE must be at least 1"
  );
}

if (
  env.SECURITY.RATE_LIMIT_POLLING_MAX <
  env.SECURITY.RATE_LIMIT_MAX
) {
  crash(
    "RATE_LIMIT_POLLING_MAX must be greater than or equal to RATE_LIMIT_MAX"
  );
}

if (
  env.DEVICE_AUTH.RATE_LIMIT_WINDOW_MS < 60000
) {
  crash(
    "DEVICE_AUTH_RATE_LIMIT_WINDOW_MS must be at least 60000"
  );
}

if (env.DEVICE_AUTH.RATE_LIMIT_MAX < 1) {
  crash(
    "DEVICE_AUTH_RATE_LIMIT_MAX must be at least 1"
  );
}

if (env.MQTT_AUTH.RATE_LIMIT_WINDOW_MS < 1000) {
  crash(
    "MQTT_AUTH_RATE_LIMIT_WINDOW_MS must be at least 1000"
  );
}

if (env.MQTT_AUTH.RATE_LIMIT_MAX < 1) {
  crash(
    "MQTT_AUTH_RATE_LIMIT_MAX must be at least 1"
  );
}

if (
  env.NODE_ENV === "production" &&
  !env.MQTT.CLIENT_PASSWORD
) {
  crash(
    "MQTT_CLIENT_PASSWORD is required in production"
  );
}

if (env.COMMUNITY.RETENTION_DAYS < 1) {
  crash(
    "COMMUNITY_RETENTION_DAYS must be at least 1"
  );
}

if (
  env.COMMUNITY.CLEANUP_INTERVAL_MS <
  60000
) {
  crash(
    "COMMUNITY_CLEANUP_INTERVAL_MS must be at least 60000"
  );
}

if (
  env.COMMUNITY.MAX_DELETE_PER_RUN < 1
) {
  crash(
    "COMMUNITY_CLEANUP_MAX_DELETE must be at least 1"
  );
}



const deepFreeze = (obj) => {
  Object.freeze(obj);
  Object.keys(obj).forEach((k) => {
    if (
      typeof obj[k] === "object" &&
      obj[k] !== null &&
      !Object.isFrozen(obj[k])
    ) {
      deepFreeze(obj[k]);
    }
  });
  return obj;
};

module.exports = deepFreeze(env);
