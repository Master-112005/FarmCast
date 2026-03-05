"use strict";

const logger = require("../utils/logger");
const {
  ERROR_CODES,
  HTTP_STATUS,
} = require("../utils/constants");



const isValidHttpStatus = (status) =>
  Number.isInteger(status) &&
  status >= 400 &&
  status <= 599;

/**
 * Normalize any error into safe API shape
 */
const normalizeError = (err = {}) => {
  let status =
    HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let code =
    ERROR_CODES.INTERNAL_ERROR;
  let message = "Unexpected server error";

  /* -------------------------------
     STATUS
  ------------------------------- */

  if (isValidHttpStatus(err.status)) {
    status = err.status;
  }

  /* -------------------------------
     SEQUELIZE ERRORS
  ------------------------------- */

  if (err.name === "SequelizeValidationError") {
    status = HTTP_STATUS.BAD_REQUEST;
    code = ERROR_CODES.VALIDATION_ERROR;
    message =
      err.errors?.[0]?.message ||
      "Validation error";
  }

  if (
    err.name ===
    "SequelizeUniqueConstraintError"
  ) {
    status = HTTP_STATUS.CONFLICT;
    code =
      ERROR_CODES.DUPLICATE_RESOURCE;
    message =
      err.errors?.[0]?.message ||
      "Duplicate resource";
  }

  /* -------------------------------
     AUTH ERRORS
  ------------------------------- */

  if (err.code === ERROR_CODES.AUTH_REQUIRED) {
    status = HTTP_STATUS.UNAUTHORIZED;
    code = ERROR_CODES.AUTH_REQUIRED;
    message =
      err.message ||
      "Authentication required";
  }

  if (err.code === ERROR_CODES.ACCESS_DENIED) {
    status = HTTP_STATUS.FORBIDDEN;
    code = ERROR_CODES.ACCESS_DENIED;
    message =
      err.message || "Access denied";
  }

  /* -------------------------------
     DOMAIN ERROR CODES
  ------------------------------- */

  if (
    err.code &&
    Object.values(ERROR_CODES).includes(
      err.code
    )
  ) {
    code = err.code;
  }

  /* -------------------------------
     MESSAGE (SAFE OVERRIDE)
  ------------------------------- */

  if (
    typeof err.message === "string" &&
    err.message.length > 0
  ) {
    message = err.message;
  }

  return { status, code, message };
};



const errorMiddleware = (
  err,
  req,
  res,
  _next
) => {
  try {
    const { status, code, message } =
      normalizeError(err);

    const correlationId =
      req.correlationId ||
      req.headers["x-correlation-id"];

    /* ----------------------------------------------
       LOG ERROR (SERVER ONLY)
    ---------------------------------------------- */

    const logPayload = {
      code,
      status,
      message,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      correlationId,
    };

    if (status >= 500) {
      logger.error("API Error", {
        ...logPayload,
        stack:
          process.env.NODE_ENV ===
          "development"
            ? err.stack
            : undefined,
      });
    } else if (
      status === HTTP_STATUS.NOT_FOUND &&
      code === ERROR_CODES.RESOURCE_NOT_FOUND
    ) {
      logger.info("API Error", logPayload);
    } else {
      logger.warn("API Error", logPayload);
    }

    /* ----------------------------------------------
       SEND SAFE RESPONSE
    ---------------------------------------------- */

    res.status(status).json({
      success: false,
      status,
      code,
      message,
      correlationId,
    });
  } catch (fatalError) {
    // Absolute last-resort fallback
    logger.fatal("Error middleware crashed", {
      message: fatalError.message,
    });

    res.status(500).json({
      success: false,
      status: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: "Critical server failure",
    });
  }
};



module.exports = Object.freeze(
  errorMiddleware
);
