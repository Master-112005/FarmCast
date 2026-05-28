"use strict";

const logger = require("../utils/logger");
const {
  ERROR_CODES,
  HTTP_STATUS,
} = require("../utils/constants");

module.exports = (req, res) => {

  if (req.originalUrl?.startsWith("/uploads/")) {
    return res.status(HTTP_STATUS.NOT_FOUND).end();
  }


  logger.warn("Route not found", {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    correlationId: req.headers["x-correlation-id"],
  });


  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    message: "API endpoint not found",
    correlationId: req.headers["x-correlation-id"],
  });
};
