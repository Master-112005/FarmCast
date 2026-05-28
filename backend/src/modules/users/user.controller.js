"use strict";

const userService = require("./user.service");
const response = require("../../utils/response");
const env = require("../../config/env");






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




const deleteMyAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await userService.deleteMyAccount(userId);

    return response.noContent(res);
  } catch (err) {
    next(err);
  }
};



module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadMyProfileImage,
  deleteMyAccount,
};
