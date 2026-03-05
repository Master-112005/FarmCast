"use strict";

const env = require("../config/env");
const logger = require("../utils/logger");
const {
  ERROR_CODES,
  AUTH,
} = require("../utils/constants");
const db = require("../models");
const {
  verifyAccessToken,
} = require("../utils/token");



if (!env?.AUTH?.JWT_SECRET) {
  throw new Error("JWT secret not configured");
}

if (!db?.User) {
  throw new Error("User model not initialized");
}



/**
 * Extract Bearer token from Authorization header
 */
const extractToken = (req) => {
  const header =
    req.headers[AUTH.HEADER_NAME.toLowerCase()];

  if (!header || typeof header !== "string") {
    return null;
  }

  const parts = header.split(" ");

  if (
    parts.length !== 2 ||
    parts[0] !== AUTH.TOKEN_TYPE ||
    !parts[1]
  ) {
    return null;
  }

  return parts[1].trim();
};

/**
 * Build standardized auth error
 */
const authError = (code, message) => {
  const err = new Error(message);
  err.code = code;
  return err;
};



const authenticate = async (req, _res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw authError(
        ERROR_CODES.AUTH_REQUIRED,
        "Authentication token missing"
      );
    }

    // Centralized JWT verification
    const payload = verifyAccessToken(token);

    const user = await db.User.findByPk(
      payload.sub
    );

    if (!user || !user.isActive) {
      throw authError(
        ERROR_CODES.AUTH_REQUIRED,
        "User not authorized"
      );
    }

    // Attach minimal trusted user
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    next();
  } catch (err) {
    logger.warn("Authentication failed", {
      message: err.message,
      path: req.originalUrl,
      ip: req.ip,
      correlationId: req.correlationId,
    });

    next(err);
  }
};



const authorize =
  (...allowedRoles) =>
  (req, _res, next) => {
    try {
      if (!req.user) {
        throw authError(
          ERROR_CODES.AUTH_REQUIRED,
          "Authentication required"
        );
      }

      if (
        allowedRoles.length &&
        !allowedRoles.includes(req.user.role)
      ) {
        throw authError(
          ERROR_CODES.ACCESS_DENIED,
          "Access denied"
        );
      }

      next();
    } catch (err) {
      logger.warn("Authorization failed", {
        role: req.user?.role,
        allowedRoles,
        path: req.originalUrl,
        correlationId: req.correlationId,
      });

      next(err);
    }
  };



module.exports = Object.freeze({
  authenticate,
  authorize,
});
