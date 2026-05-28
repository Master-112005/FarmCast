"use strict";

const db = require("../models");
const logger = require("../utils/logger");

const { Op } = db.Sequelize;



const CONFIG = Object.freeze({
  ENABLED: false,
  DRY_RUN: true,
  MAX_ROWS_PER_RUN: 1000,

  REFRESH_TOKEN_TTL_DAYS: 30,
  SOIL_DATA_RETENTION_DAYS: 365,
});






const daysAgo = (days) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);




const assertEnabled = () => {
  if (!CONFIG.ENABLED) {
    logger.info(
      "Cleanup job skipped (disabled by config)"
    );
    return false;
  }
  return true;
};






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


  }
};



module.exports = {
  runCleanupJob,
  CONFIG,
};
