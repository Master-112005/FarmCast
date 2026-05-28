"use strict";

const logger = require("../utils/logger");
const {
  ERROR_CODES,
  HTTP_STATUS,
} = require("../utils/constants");






const accessError = (code, message) => {
  const err = new Error(message);
  err.code = code;
  err.status = HTTP_STATUS.FORBIDDEN;
  return err;
};










const requireRole =
  (...allowedRoles) =>
  (req, _res, next) => {
    try {
      if (!req.user) {
        throw accessError(
          ERROR_CODES.AUTH_REQUIRED,
          "Authentication required"
        );
      }

      if (
        allowedRoles.length > 0 &&
        !allowedRoles.includes(req.user.role)
      ) {
        throw accessError(
          ERROR_CODES.ACCESS_DENIED,
          "Insufficient permissions"
        );
      }

      next();
    } catch (err) {
      logger.warn("RBAC role check failed", {
        userId: req.user?.id,
        role: req.user?.role,
        allowedRoles,
        path: req.originalUrl,
        correlationId:
          req.headers["x-correlation-id"],
      });

      next(err);
    }
  };















const requireOwnership =
  ({ getOwnerId }) =>
  async (req, _res, next) => {
    try {
      if (!req.user) {
        throw accessError(
          ERROR_CODES.AUTH_REQUIRED,
          "Authentication required"
        );
      }



      if (typeof getOwnerId !== "function") {
        throw accessError(
          ERROR_CODES.INTERNAL_ERROR,
          "Ownership resolver not configured"
        );
      }

      const ownerId = await getOwnerId(req);

      if (!ownerId) {
        throw accessError(
          ERROR_CODES.RESOURCE_NOT_FOUND,
          "Resource not found"
        );
      }

      if (ownerId !== req.user.id) {
        throw accessError(
          ERROR_CODES.ACCESS_DENIED,
          "You do not own this resource"
        );
      }

      next();
    } catch (err) {
      logger.warn("Ownership check failed", {
        userId: req.user?.id,
        role: req.user?.role,
        path: req.originalUrl,
        correlationId:
          req.headers["x-correlation-id"],
        message: err.message,
      });

      next(err);
    }
  };



module.exports = {
  requireRole,
  requireOwnership,
};
