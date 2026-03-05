"use strict";

const jwt = require("jsonwebtoken");
const env = require("../config/env");
const logger = require("../utils/logger");

const BASE_URL = String(env.ML.BASE_URL || "").replace(/\/$/, "");

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

    // Send both headers for compatibility across ML service variants.
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
  return err;
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

  const headers = {
    ...buildAuthHeaders(),
    ...(options.headers || {}),
  };

  let response;

  try {
    response = await fetchWithTimeout(url, {
      ...options,
      headers,
    });
  } catch (error) {
    const isTimeout = error?.name === "AbortError";

    const message = isTimeout
      ? "ML service request timed out"
      : "ML service unavailable";

    logger.error("ML service request failed", {
      path,
      url,
      message,
      cause: error?.message,
    });

    throw createError(message, 502, {
      cause: error?.message,
      url,
    });
  }

  const payload = await parseJson(response);

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      `ML service error (${response.status})`;

    logger.warn("ML service request failed", {
      path,
      status: response.status,
      message,
    });

    throw createError(message, response.status, payload);
  }

  return payload;
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
