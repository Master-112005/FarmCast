"use strict";

const {
  HTTP_STATUS,
  ERROR_CODES,
} = require("./constants");



const isValidStatus = (status) =>
  Number.isInteger(status) &&
  status >= 100 &&
  status <= 599;

const getCorrelationId = (req) =>
  req?.correlationId ||
  req?.headers?.["x-correlation-id"] ||
  null;

const buildPayload = (payload) =>
  Object.freeze(payload);



const success = (
  res,
  data,
  status = HTTP_STATUS.OK,
  meta
) => {
  const finalStatus = isValidStatus(status)
    ? status
    : HTTP_STATUS.OK;

  const payload = {
    success: true,
    status: finalStatus,
    data: data ?? null,
    correlationId: getCorrelationId(res.req),
  };

  if (meta && typeof meta === "object") {
    payload.meta = meta;
  }

  return res
    .status(finalStatus)
    .json(buildPayload(payload));
};

const created = (res, data, meta) =>
  success(
    res,
    data,
    HTTP_STATUS.CREATED,
    meta
  );

const noContent = (res) =>
  res
    .status(HTTP_STATUS.NO_CONTENT)
    .json(
      buildPayload({
        success: true,
        status: HTTP_STATUS.NO_CONTENT,
        data: null,
        correlationId: getCorrelationId(
          res.req
        ),
      })
    );



const error = (res, options = {}) => {
  const status = isValidStatus(options.status)
    ? options.status
    : HTTP_STATUS.INTERNAL_SERVER_ERROR;

  const code =
    options.code ||
    ERROR_CODES.INTERNAL_ERROR;

  const message =
    typeof options.message === "string"
      ? options.message
      : "Unexpected server error";

  return res.status(status).json(
    buildPayload({
      success: false,
      status,
      code,
      message,
      correlationId: getCorrelationId(
        res.req
      ),
    })
  );
};



const badRequest = (res, message) =>
  error(res, {
    status: HTTP_STATUS.BAD_REQUEST,
    code: ERROR_CODES.VALIDATION_ERROR,
    message,
  });

const unauthorized = (res, message) =>
  error(res, {
    status: HTTP_STATUS.UNAUTHORIZED,
    code: ERROR_CODES.AUTH_REQUIRED,
    message,
  });

const forbidden = (res, message) =>
  error(res, {
    status: HTTP_STATUS.FORBIDDEN,
    code: ERROR_CODES.ACCESS_DENIED,
    message,
  });

const notFound = (res, message) =>
  error(res, {
    status: HTTP_STATUS.NOT_FOUND,
    code: ERROR_CODES.RESOURCE_NOT_FOUND,
    message,
  });



module.exports = Object.freeze({
  success,
  created,
  noContent,

  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
});
