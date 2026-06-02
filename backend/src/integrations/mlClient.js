"use strict";

const crypto = require("crypto");
const axios = require("axios");
const axiosRetryModule = require("axios-retry");
const jwt = require("jsonwebtoken");

const env = require("../config/env");
const logger = require("../utils/logger");

const axiosRetry = axiosRetryModule.default || axiosRetryModule;
const BASE_URL = String(env.ML.BASE_URL || "").replace(/\/$/, "");
const ML_TIMEOUT_MS = Number(process.env.ML_SERVICE_TIMEOUT_MS || 180000);
const MAX_RETRIES = 3;

let cachedToken = null;
let cachedTokenExp = 0;

const mlAxios = axios.create({
  timeout: ML_TIMEOUT_MS,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

const getResponseStatus = (error) => error?.response?.status;

const isRetryableMlError = (error) =>
  error?.code === "ECONNABORTED" ||
  error?.code === "ECONNRESET" ||
  error?.code === "ETIMEDOUT" ||
  error?.code === "EPIPE" ||
  /socket hang up/i.test(error?.message || "") ||
  (Number(getResponseStatus(error)) >= 500);

axiosRetry(mlAxios, {
  retries: MAX_RETRIES,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: isRetryableMlError,
  onRetry: (retryCount, error, requestConfig) => {
    const metadata = requestConfig?.metadata || {};
    logger.warn("ML request retry", {
      requestId: metadata.requestId,
      method: requestConfig?.method?.toUpperCase(),
      url: requestConfig?.url,
      retryCount,
      maxRetries: MAX_RETRIES,
      code: error?.code || null,
      status: getResponseStatus(error) || null,
      message: error?.message,
      responseBody: error?.response?.data || null,
    });
  },
});

const buildJwtToken = () => {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedTokenExp - now > 30) {
    return cachedToken;
  }

  const exp = now + 300;

  const payload = {
    sub: "backend-service",
    role: "backend",
    iss: env.ML.JWT_ISSUER,
    aud: env.ML.JWT_AUDIENCE,
    exp,
  };

  const token = jwt.sign(payload, env.ML.JWT_SECRET, {
    algorithm: env.ML.JWT_ALGORITHM,
  });

  cachedToken = token;
  cachedTokenExp = exp;
  return token;
};

const buildAuthHeaders = () => {
  if (env.ML.AUTH_MODE === "api_key") {
    if (!env.ML.API_KEY) {
      throw new Error("ML service API key not configured");
    }

    return {
      "X-API-Key": env.ML.API_KEY,
      Authorization: `Bearer ${env.ML.API_KEY}`,
    };
  }

  if (env.ML.AUTH_MODE === "jwt") {
    return {
      Authorization: `Bearer ${buildJwtToken()}`,
    };
  }

  throw new Error("Unsupported ML auth mode");
};

const createError = (message, status, details) => {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  err.code = details?.code;
  err.cause = details?.cause;
  return err;
};

const summarizePayload = (payload) => {
  if (payload == null) return payload;

  if (typeof payload === "string") {
    return payload.length > 2000
      ? `${payload.slice(0, 2000)}...`
      : payload;
  }

  try {
    const serialized = JSON.stringify(payload);
    if (serialized.length <= 2000) return payload;
    return `${serialized.slice(0, 2000)}...`;
  } catch {
    return "[unserializable]";
  }
};

const buildUrl = (path) => {
  if (!BASE_URL) {
    const err = new Error("ML service base URL not configured");
    err.status = 500;
    throw err;
  }

  return `${BASE_URL}${path}`;
};

const resolveErrorStatus = (error) => {
  const status = Number(error?.response?.status);
  return status >= 400 ? status : 502;
};

const resolveErrorMessage = (error) =>
  error?.response?.data?.detail ||
  error?.response?.data?.message ||
  error?.message ||
  "ML service unavailable";

const request = async ({
  method,
  path,
  data,
  headers = {},
}) => {
  const url = buildUrl(path);
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const requestHeaders = {
    ...buildAuthHeaders(),
    ...headers,
  };

  console.log("Sending request to ML service...");
  logger.info("ML request start", {
    requestId,
    method,
    path,
    url,
    timeoutMs: ML_TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });

  try {
    const requestConfig = {
      headers: requestHeaders,
      timeout: ML_TIMEOUT_MS,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      metadata: {
        requestId,
        startedAt,
        path,
      },
    };

    const response =
      method === "POST"
        ? await mlAxios.post(url, data, requestConfig)
        : await mlAxios.get(url, requestConfig);

    const durationMs = Date.now() - startedAt;

    console.log("ML response:", response.data);
    logger.info("ML response received", {
      requestId,
      path,
      url,
      status: response.status,
      durationMs,
      responseBody: summarizePayload(response.data),
    });

    return response.data;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const timeout =
      error?.code === "ECONNABORTED" ||
      error?.code === "ETIMEDOUT" ||
      /timeout/i.test(error?.message || "");
    const status = resolveErrorStatus(error);
    const message = resolveErrorMessage(error);

    console.error("ML ERROR:", error.message);
    console.error(error.response?.data);
    logger.error("ML request failed", {
      requestId,
      path,
      url,
      status,
      code: error?.code || null,
      message,
      timeout,
      timeoutMs: ML_TIMEOUT_MS,
      durationMs,
      responseBody: summarizePayload(error?.response?.data),
    });

    throw createError(message, status, {
      code: error?.code,
      cause: error?.message,
      timeout,
      status,
      url,
      responseBody: error?.response?.data,
    });
  }
};

const postJson = (path, body) =>
  request({
    method: "POST",
    path,
    data: body || {},
    headers: {
      "Content-Type": "application/json",
    },
  });

const postForm = (path, formData) =>
  request({
    method: "POST",
    path,
    data: formData,
    headers:
      typeof formData?.getHeaders === "function"
        ? formData.getHeaders()
        : {},
  });

const predictYield = (payload) =>
  postJson("/predict/yield", payload);

const predictDisease = (formData) =>
  postForm("/predict/disease", formData);

const healthCheck = () =>
  request({
    method: "GET",
    path: "/health",
  });

module.exports = {
  predictYield,
  predictDisease,
  healthCheck,
};
