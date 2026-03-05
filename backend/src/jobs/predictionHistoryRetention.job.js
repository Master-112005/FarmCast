"use strict";

const env = require("../config/env");
const db = require("../models");
const logger = require("../utils/logger");

const { Op } = db.Sequelize;

const getCutoffDate = () =>
  new Date(
    Date.now() -
      env.PREDICTION_HISTORY.RETENTION_DAYS *
        24 *
        60 *
        60 *
        1000
  );

const cleanupPredictionHistory = async () => {
  if (!db.PredictionHistory) {
    return 0;
  }

  const deleted = await db.PredictionHistory.destroy({
    where: {
      createdAt: {
        [Op.lt]: getCutoffDate(),
      },
    },
    limit: env.PREDICTION_HISTORY.MAX_DELETE_PER_RUN,
  });

  if (deleted > 0) {
    logger.info("Prediction history cleanup executed", {
      deleted,
      retentionDays:
        env.PREDICTION_HISTORY.RETENTION_DAYS,
      maxDeletePerRun:
        env.PREDICTION_HISTORY.MAX_DELETE_PER_RUN,
    });
  }

  return deleted;
};

const startPredictionHistoryRetentionJob = () => {
  if (!env.PREDICTION_HISTORY.CLEANUP_ENABLED) {
    logger.info(
      "Prediction history cleanup scheduler disabled"
    );
    return () => {};
  }

  const runSafely = async () => {
    try {
      await cleanupPredictionHistory();
    } catch (err) {
      logger.error("Prediction history cleanup failed", {
        message: err.message,
      });
    }
  };

  // Run once on startup.
  runSafely();

  const intervalId = setInterval(
    runSafely,
    env.PREDICTION_HISTORY.CLEANUP_INTERVAL_MS
  );

  if (typeof intervalId.unref === "function") {
    intervalId.unref();
  }

  logger.info("Prediction history cleanup scheduler started", {
    intervalMs:
      env.PREDICTION_HISTORY.CLEANUP_INTERVAL_MS,
    retentionDays:
      env.PREDICTION_HISTORY.RETENTION_DAYS,
  });

  return () => {
    clearInterval(intervalId);
    logger.info(
      "Prediction history cleanup scheduler stopped"
    );
  };
};

module.exports = Object.freeze({
  cleanupPredictionHistory,
  startPredictionHistoryRetentionJob,
});
