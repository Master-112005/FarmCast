/**
 * src/jobs/communityPostRetention.job.js
 * ------------------------------------------------------
 * Community Post Retention Scheduler
 *
 * Responsibilities:
 * - Automatically delete community posts older than retention TTL
 * - Remove corresponding uploaded community images
 */

"use strict";

const fs = require("fs");
const path = require("path");

const env = require("../config/env");
const db = require("../models");
const logger = require("../utils/logger");

const { Op } = db.Sequelize;

const getCutoffDate = () =>
  new Date(
    Date.now() -
      env.COMMUNITY.RETENTION_DAYS *
        24 *
        60 *
        60 *
        1000
  );

const resolveUploadPath = (imagePath) =>
  path.resolve(
    process.cwd(),
    env.UPLOADS.DIR,
    String(imagePath || "")
  );

const safeDeleteFile = async (filePath) => {
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch (err) {
    if (err.code === "ENOENT") {
      return false;
    }
    logger.warn("Community image delete skipped", {
      filePath,
      message: err.message,
    });
    return false;
  }
};

const cleanupCommunityPosts = async () => {
  if (!db.CommunityPost) {
    return { deletedPosts: 0, deletedFiles: 0 };
  }

  const expiredPosts = await db.CommunityPost.findAll({
    where: {
      createdAt: {
        [Op.lt]: getCutoffDate(),
      },
    },
    attributes: ["id", "imagePath"],
    order: [["createdAt", "ASC"]],
    limit: env.COMMUNITY.MAX_DELETE_PER_RUN,
  });

  if (!expiredPosts.length) {
    return { deletedPosts: 0, deletedFiles: 0 };
  }

  let deletedFiles = 0;
  const ids = [];

  for (const post of expiredPosts) {
    ids.push(post.id);
    if (post.imagePath) {
      const deleted = await safeDeleteFile(
        resolveUploadPath(post.imagePath)
      );
      if (deleted) deletedFiles += 1;
    }
  }

  const deletedPosts = await db.CommunityPost.destroy({
    where: { id: ids },
  });

  if (deletedPosts > 0) {
    logger.info("Community post cleanup executed", {
      deletedPosts,
      deletedFiles,
      retentionDays: env.COMMUNITY.RETENTION_DAYS,
      maxDeletePerRun:
        env.COMMUNITY.MAX_DELETE_PER_RUN,
    });
  }

  return { deletedPosts, deletedFiles };
};

const startCommunityPostRetentionJob = () => {
  if (!env.COMMUNITY.CLEANUP_ENABLED) {
    logger.info(
      "Community post cleanup scheduler disabled"
    );
    return () => {};
  }

  const runSafely = async () => {
    try {
      await cleanupCommunityPosts();
    } catch (err) {
      logger.error("Community post cleanup failed", {
        message: err.message,
      });
    }
  };

  runSafely();

  const intervalId = setInterval(
    runSafely,
    env.COMMUNITY.CLEANUP_INTERVAL_MS
  );

  if (typeof intervalId.unref === "function") {
    intervalId.unref();
  }

  logger.info(
    "Community post cleanup scheduler started",
    {
      intervalMs: env.COMMUNITY.CLEANUP_INTERVAL_MS,
      retentionDays: env.COMMUNITY.RETENTION_DAYS,
    }
  );

  return () => {
    clearInterval(intervalId);
    logger.info(
      "Community post cleanup scheduler stopped"
    );
  };
};

module.exports = Object.freeze({
  cleanupCommunityPosts,
  startCommunityPostRetentionJob,
});
