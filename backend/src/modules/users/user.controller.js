/**
 * src/modules/users/user.controller.js
 * ------------------------------------------------------
 * User Controller
 *
 * CRITICAL FILE (HTTP ↔ USER DOMAIN ADAPTER)
 *
 * Responsibilities:
 * - Handle HTTP requests for user/profile flows
 * - Delegate all logic to user.service
 * - Return standardized API responses
 *
 * Rules:
 * - NO business logic
 * - NO database access
 * - NO RBAC decisions here
 *
 * If this file is wrong → user flows break
 */

"use strict";

const userService = require("./user.service");
const response = require("../../utils/response");
const env = require("../../config/env");

/* ======================================================
   USER: SELF PROFILE
====================================================== */

/**
 * GET /api/v1/users/me
 */
const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const profile =
      await userService.getMyProfile(userId);

    return response.success(res, profile);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/users/me
 */
const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    const updated =
      await userService.updateMyProfile(
        userId,
        updates
      );

    return response.success(res, updated);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/users/me/upload
 */
const uploadMyProfileImage = async (
  req,
  res,
  next
) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    const baseUrl = env.APP_BASE_URL.replace(/\/$/, "");
    const imageUrl = `${baseUrl}/uploads/profiles/${file.filename}`;

    const updated =
      await userService.updateMyProfileImage(
        userId,
        imageUrl
      );

    return response.success(res, updated);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/v1/users/me
 */
const deleteMyAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await userService.deleteMyAccount(userId);

    return response.noContent(res);
  } catch (err) {
    next(err);
  }
};

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadMyProfileImage,
  deleteMyAccount,
};
