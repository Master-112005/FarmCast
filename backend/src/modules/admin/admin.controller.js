"use strict";

const adminService = require("./admin.service");
const response = require("../../utils/response");

const getUsers = async (_req, res, next) => {
  try {
    const users = await adminService.getAdminUsers();
    return response.success(res, users);
  } catch (err) {
    next(err);
  }
};

const getOverview = async (_req, res, next) => {
  try {
    const overview =
      await adminService.getAdminOverview();
    return response.success(res, overview);
  } catch (err) {
    next(err);
  }
};

const getUserPredictions = async (
  req,
  res,
  next
) => {
  try {
    const history =
      await adminService.getUserPredictionHistory(
        req.params.userId,
        {
          limit: req.query.limit,
        }
      );
    return response.success(res, history);
  } catch (err) {
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const result = await adminService.deleteUserByAdmin(
      req.params.userId,
      req.user?.id,
      {
        message: req.body?.message,
      }
    );
    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getOverview,
  getUsers,
  getUserPredictions,
  deleteUser,
};
