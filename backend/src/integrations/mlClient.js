"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const logger = require("../utils/logger");

const BASE_URL = String(env.ML.BASE_URL || "").replace(/\/$/, "");
const MAX_ATTEMPTS = 4;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 10000;
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);

let cachedToken = null;
let cachedTokenExp = 0;



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

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const getErrorCode = (error) =>
  error?.code ||
  error?.cause?.code ||
  error?.cause?.name ||
  error?.name ||
  null;

const isSocketHangUp = (error) =>
  /socket hang up/i.test(
    `${error?.message || ""} ${error?.cause?.message || ""}`
  );

const isTimeoutError = (error) =>
  error?.name === "AbortError" ||
  getErrorCode(error) === "ETIMEDOUT" ||
  getErrorCode(error) === "UND_ERR_CONNECT_TIMEOUT" ||
  getErrorCode(error) === "UND_ERR_HEADERS_TIMEOUT" ||
  getErrorCode(error) === "UND_ERR_BODY_TIMEOUT";

const isRetryableNetworkError = (error) =>
  isTimeoutError(error) ||
  isSocketHangUp(error) ||
  RETRYABLE_ERROR_CODES.has(getErrorCode(error));

const shouldRetryResponse = (response) =>
  RETRYABLE_STATUS_CODES.has(response.status);

const getRetryDelayMs = (attempt) => {
  const exponential = BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(exponential + jitter, MAX_RETRY_DELAY_MS);
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

const parseJson = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, env.ML.TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};



const request = async (path, options = {}) => {
  if (!BASE_URL) {
    const err = new Error("ML service base URL not configured");
    err.status = 500;
    throw err;
  }

  const url = `${BASE_URL}${path}`;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  const headers = {
    ...buildAuthHeaders(),
    ...(options.headers || {}),
  };

  logger.info("ML request start", {
    requestId,
    method: options.method || "GET",
    path,
    url,
    timeoutMs: env.ML.TIMEOUT_MS,
    maxAttempts: MAX_ATTEMPTS,
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const attemptStartedAt = Date.now();
    let response;

    try {
      response = await fetchWithTimeout(url, {
        ...options,
        headers,
      });
    } catch (error) {
      const durationMs = Date.now() - attemptStartedAt;
      const timeout = isTimeoutError(error);
      const retryable = isRetryableNetworkError(error);
      const finalAttempt = attempt === MAX_ATTEMPTS;
      const delayMs =
        retryable && !finalAttempt ? getRetryDelayMs(attempt) : 0;

      logger.warn("ML request transport failure", {
        requestId,
        path,
        url,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        durationMs,
        timeoutMs: env.ML.TIMEOUT_MS,
        timeout,
        retryable,
        finalAttempt,
        retryDelayMs: delayMs,
        code: getErrorCode(error),
        cause: error?.cause?.message || error?.message,
      });

      if (retryable && !finalAttempt) {
        logger.info("ML request retry scheduled", {
          requestId,
          path,
          attempt,
          nextAttempt: attempt + 1,
          retryDelayMs: delayMs,
        });
        await sleep(delayMs);
        continue;
      }

      const message = timeout
        ? "ML service request timed out"
        : "ML service unavailable";

      logger.error("ML request failed", {
        requestId,
        path,
        url,
        attempt,
        durationMs: Date.now() - startedAt,
        message,
      });

      throw createError(message, 502, {
        cause: error?.cause?.message || error?.message,
        code: getErrorCode(error),
        timeout,
        url,
      });
    }

    const payload = await parseJson(response);
    const attemptDurationMs = Date.now() - attemptStartedAt;

    logger.info("ML response received", {
      requestId,
      path,
      attempt,
      status: response.status,
      durationMs: attemptDurationMs,
      responseBody: summarizePayload(payload),
    });

    if (response.ok) {
      logger.info("ML request completed", {
        requestId,
        path,
        status: response.status,
        attempts: attempt,
        durationMs: Date.now() - startedAt,
      });
      return payload;
    }

    const message =
      payload?.detail ||
      payload?.message ||
      `ML service error (${response.status})`;

    const retryable = shouldRetryResponse(response);
    const finalAttempt = attempt === MAX_ATTEMPTS;
    const delayMs =
      retryable && !finalAttempt ? getRetryDelayMs(attempt) : 0;

    logger.warn("ML request returned error response", {
      requestId,
      path,
      url,
      attempt,
      maxAttempts: MAX_ATTEMPTS,
      message,
      status: response.status,
      retryable,
      finalAttempt,
      retryDelayMs: delayMs,
      responseBody: summarizePayload(payload),
    });

    if (retryable && !finalAttempt) {
      logger.info("ML request retry scheduled", {
        requestId,
        path,
        attempt,
        nextAttempt: attempt + 1,
        retryDelayMs: delayMs,
        status: response.status,
      });
      await sleep(delayMs);
      continue;
    }

    throw createError(message, response.status, {
      ...((payload && typeof payload === "object") ? payload : { payload }),
      status: response.status,
      url,
    });
  }

  throw createError("ML service unavailable", 502, { url });
};



const postJson = (path, body) =>
  request(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });

const postForm = (path, form) =>
  request(path, {
    method: "POST",
    body: form,
  });

const predictYield = (payload) =>
  postJson("/predict/yield", payload);

const predictDisease = (formData) =>
  postForm("/predict/disease", formData);

const healthCheck = () =>
  request("/health", { method: "GET" });

module.exports = {
  predictYield,
  predictDisease,
  healthCheck,
};
