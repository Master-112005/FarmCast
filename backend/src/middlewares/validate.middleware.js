"use strict";

const logger = require("../utils/logger");
const {
  ERROR_CODES,
  HTTP_STATUS,
} = require("../utils/constants");



/**
 * Executes schema validation safely.
 * Supports Joi, Zod, Yup-like APIs.
 */
const runValidation = (schema, data) => {
  // Joi-style
  if (typeof schema.validate === "function") {
    const { error, value } = schema.validate(data, {
      abortEarly: true,
      stripUnknown: true,
    });
    return { error, value };
  }

  // Zod-style
  if (typeof schema.safeParse === "function") {
    const result = schema.safeParse(data);
    if (!result.success) {
      return {
        error: result.error.errors?.[0],
      };
    }
    return { value: result.data };
  }

  // Yup-style
  if (typeof schema.validateSync === "function") {
    try {
      const value = schema.validateSync(data, {
        abortEarly: true,
        stripUnknown: true,
      });
      return { value };
    } catch (error) {
      return { error };
    }
  }

  throw new Error("Unsupported validation schema");
};



/**
 * Validation middleware factory
 *
 * @param {Object} schemas
 * {
 *   body?: schema,
 *   query?: schema,
 *   params?: schema
 * }
 */
module.exports = (schemas = {}) => {
  return (req, res, next) => {
    try {
      const locations = ["body", "query", "params"];

      for (const location of locations) {
        const schema = schemas[location];
        if (!schema) continue;

        const { error, value } = runValidation(
          schema,
          req[location]
        );

        if (error) {
          logger.warn("Validation failed", {
            location,
            path: req.originalUrl,
            message: error.message,
            correlationId:
              req.headers["x-correlation-id"],
          });

          return res
            .status(HTTP_STATUS.BAD_REQUEST)
            .json({
              success: false,
              status: HTTP_STATUS.BAD_REQUEST,
              code: ERROR_CODES.VALIDATION_ERROR,
              message:
                error.message || "Invalid request data",
              correlationId:
                req.headers["x-correlation-id"],
            });
        }

        // Replace with validated & sanitized data
        req[location] = value;
      }

      next();
    } catch (err) {
      // Validation infrastructure failure (rare, critical)
      logger.error("Validation middleware error", {
        message: err.message,
        path: req.originalUrl,
        correlationId:
          req.headers["x-correlation-id"],
      });

      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          status:
            HTTP_STATUS.INTERNAL_SERVER_ERROR,
          code: ERROR_CODES.INTERNAL_ERROR,
          message:
            "Request validation failed unexpectedly",
          correlationId:
            req.headers["x-correlation-id"],
        });
    }
  };
};
