"use strict";

const authService = require("./auth.service");
const response = require("../../utils/response");



if (!authService) {
  throw new Error(
    "AuthService dependency missing"
  );
}



const register = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { name, email, password } = body;

    const user = await authService.register({
      name,
      email,
      password,
    });

    return response.created(res, user);
  } catch (err) {
    next(err);
  }
};



const login = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { email, password } = body;

    const result = await authService.login({
      email,
      password,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      correlationId: req.correlationId,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};



const refresh = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { refreshToken } = body;

    const result = await authService.refresh({
      refreshToken,
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      correlationId: req.correlationId,
    });

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};



const logout = async (req, res, next) => {
  try {
    const body = req.body || {};
    const { refreshToken } = body;

    await authService.logout({
      refreshToken,
      correlationId: req.correlationId,
    });

    return response.noContent(res);
  } catch (err) {
    next(err);
  }
};



module.exports = Object.freeze({
  register,
  login,
  refresh,
  logout,
});
