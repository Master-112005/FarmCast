/**
 * src/jobs/cleanup.job.js
 * ------------------------------------------------------
 * Background Cleanup Job
 *
 * CRITICAL FILE (DATA HYGIENE & SYSTEM STABILITY)
 *
 * Responsibilities:
 * - Safely clean expired / orphaned data
 * - Never impact live traffic
 * - Never delete active user data
 *
 * Safety Guarantees:
 * - Disabled by default
 * - Dry-run support
 * - Hard limits on deletions
 * - Fully logged
 *
 * If this file is wrong → silent data loss or downtime
 */

"use strict";

const db = require("../models");
const logger = require("../utils/logger");

const { Op } = db.Sequelize;

/* ======================================================
   CONFIGURATION (SAFE DEFAULTS)
====================================================== */

const CONFIG = Object.freeze({
  ENABLED: false, // 🔒 MUST be explicitly enabled
  DRY_RUN: true, // 🔒 Log only, no deletes
  MAX_ROWS_PER_RUN: 1000, // 🔒 Hard safety cap

  REFRESH_TOKEN_TTL_DAYS: 30,
  SOIL_DATA_RETENTION_DAYS: 365, // 1 year
});

/* ======================================================
   INTERNAL HELPERS
====================================================== */

/**
 * Calculate date before N days
 */
const daysAgo = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

/**
 * Guard: job must be explicitly enabled
 */
const assertEnabled = () => {
  if (!CONFIG.ENABLED) {
    logger.info(
      "Cleanup job skipped (disabled by config)"
    );
    return false;
  }
  return true;
};

/* ======================================================
   CLEANUP TASKS
====================================================== */

/**
 * Cleanup expired refresh tokens
 */
const cleanupRefreshTokens = async () => {
  const expiryDate = daysAgo(
    CONFIG.REFRESH_TOKEN_TTL_DAYS
  );

  const where = {
    expiresAt: { [Op.lt]: expiryDate },
  };

  const count =
    await db.RefreshToken.count({ where });

  if (count === 0) {
    return logger.info(
      "No expired refresh tokens found"
    );
  }

  const limit = Math.min(
    count,
    CONFIG.MAX_ROWS_PER_RUN
  );

  if (CONFIG.DRY_RUN) {
    return logger.warn(
      "DRY-RUN: Refresh tokens eligible for deletion",
      { count: limit }
    );
  }

  const deleted =
    await db.RefreshToken.destroy({
      where,
      limit,
    });

  logger.warn("Expired refresh tokens deleted", {
    deleted,
  });
};

/**
 * Cleanup old soil records
 *
 * NOTE:
 * - Keeps recent data for analytics & ML
 * - Does NOT delete device or user data
 */
const cleanupOldSoilRecords = async () => {
  const cutoffDate = daysAgo(
    CONFIG.SOIL_DATA_RETENTION_DAYS
  );

  const where = {
    recordedAt: { [Op.lt]: cutoffDate },
  };

  const count =
    await db.SoilRecord.count({ where });

  if (count === 0) {
    return logger.info(
      "No old soil records found"
    );
  }

  const limit = Math.min(
    count,
    CONFIG.MAX_ROWS_PER_RUN
  );

  if (CONFIG.DRY_RUN) {
    return logger.warn(
      "DRY-RUN: Soil records eligible for deletion",
      { count: limit }
    );
  }

  const deleted =
    await db.SoilRecord.destroy({
      where,
      limit,
    });

  logger.warn("Old soil records deleted", {
    deleted,
  });
};

/* ======================================================
   JOB EXECUTOR
====================================================== */

/**
 * Execute cleanup job
 *
 * Designed to be called by:
 * - Cron
 * - Queue worker
 * - Manual admin trigger
 */
const runCleanupJob = async () => {
  if (!assertEnabled()) return;

  logger.info("Cleanup job started");

  try {
    await cleanupRefreshTokens();
    await cleanupOldSoilRecords();

    logger.info("Cleanup job completed");
  } catch (err) {
    logger.error("Cleanup job failed", {
      message: err.message,
      stack: err.stack,
    });

    // Never crash host process
  }
};

/* ======================================================
   EXPORT
====================================================== */

module.exports = {
  runCleanupJob,
  CONFIG, // exported for visibility & testing
};
