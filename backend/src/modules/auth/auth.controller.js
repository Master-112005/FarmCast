/**
 * src/modules/auth/auth.controller.js
 * ------------------------------------------------------
 * Authentication Controller (Enterprise Hardened)
 *
 * CRITICAL FILE (HTTP ↔ AUTH DOMAIN ADAPTER)
 *
 * Responsibilities:
 * - Handle HTTP requests for auth flows
 * - Delegate all logic to auth.service
 * - Return standardized API responses
 *
 * Rules:
 * - NO business logic
 * - NO direct DB access
 * - NO token generation here
 */

"use strict";

const authService = require("./auth.service");
const response = require("../../utils/response");

/* ======================================================
   SAFETY CHECKS
====================================================== */

if (!authService) {
  throw new Error(
    "AuthService dependency missing"
  );
}

/* ======================================================
   REGISTER
====================================================== */

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

/* ======================================================
   LOGIN
====================================================== */

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

/* ======================================================
   REFRESH TOKEN
====================================================== */

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

/* ======================================================
   LOGOUT
====================================================== */

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

/* ======================================================
   EXPORTS (IMMUTABLE)
====================================================== */

module.exports = Object.freeze({
  register,
  login,
  refresh,
  logout,
});
