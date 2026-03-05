"use strict";

const db = require("../../models");
const logger = require("../../utils/logger");
const { USER_ERRORS } = require("./user.constants");



/**
 * Build domain error (handled by global error middleware)
 */
const domainError = (
  code,
  message,
  status = 400
) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

/**
 * Ensure user exists and is active
 */
const getActiveUserById = async (userId) => {
  const user = await db.User.findByPk(userId);

  if (!user) {
    throw domainError(
      USER_ERRORS.USER_NOT_FOUND,
      "User not found",
      404
    );
  }

  if (!user.isActive) {
    throw domainError(
      USER_ERRORS.USER_DISABLED,
      "User account is disabled",
      403
    );
  }

  return user;
};



/**
 * Get current user's profile
 */
const getMyProfile = async (userId) => {
  const user = await getActiveUserById(userId);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    fieldSize: user.fieldSize,
    profileImage: user.profileImage,
    role: user.role,
    createdAt: user.createdAt,
  };
};

/**
 * Update current user's profile
 */
const updateMyProfile = async (
  userId,
  updates
) => {
  const user = await getActiveUserById(userId);

  // Only allowed fields reach here (schema enforced)
  Object.assign(user, updates);

  await user.save();

  logger.info("User profile updated", {
    userId: user.id,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    fieldSize: user.fieldSize,
    profileImage: user.profileImage,
  };
};

/**
 * Update current user's profile image
 */
const updateMyProfileImage = async (
  userId,
  imageUrl
) => {
  const user = await getActiveUserById(userId);

  user.profileImage = imageUrl;
  await user.save();

  logger.info("User profile image updated", {
    userId: user.id,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    address: user.address,
    fieldSize: user.fieldSize,
    profileImage: user.profileImage,
  };
};

/**
 * Delete current user's account and related data
 */
const deleteMyAccount = async (userId) => {
  const tx = await db.sequelize.transaction();

  try {
    const user = await getActiveUserById(userId);

    const devices = await db.Device.findAll({
      where: { userId },
      attributes: ["id"],
      transaction: tx,
    });

    const deviceIds = devices.map((d) => d.id);

    if (deviceIds.length > 0) {
      await db.SoilRecord.destroy({
        where: { deviceId: deviceIds },
        transaction: tx,
      });

      await db.Device.destroy({
        where: { id: deviceIds },
        force: true,
        transaction: tx,
      });
    }

    await db.RefreshToken.destroy({
      where: { userId },
      transaction: tx,
    });

    await user.destroy({ force: true, transaction: tx });

    await tx.commit();

    logger.warn("User account deleted", {
      userId,
    });

    return true;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
};



module.exports = {
  getMyProfile,
  updateMyProfile,
  updateMyProfileImage,
  deleteMyAccount,
};
