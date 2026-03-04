/**
 * api.js
 * ------------------------------------------------------
 * FarmCast – Enterprise Transport Layer
 *
 * Tier: 0 (Platform Backbone)
 *
 * Guarantees:
 * - Stable request / response contract
 * - JWT auto injection
 * - Retry-once for transient faults
 * - Centralized error normalization
 * - Correlation IDs for tracing
 * - Zero UI crashes
 */

"use strict";

import axios from "axios";
import {
  ENV,
  API_BASE,
  ENDPOINTS,
  LIMITS,
  STORAGE_KEYS,
} from "../utils/constants";

/* ======================================================
   RUNTIME DEFAULTS
====================================================== */

const API_BASE_URL = API_BASE || "http://localhost:5000/api/v1";

const REQUEST_TIMEOUT =
  LIMITS?.REQUEST_TIMEOUT_MS || 15000;

const AUTH_TOKEN_KEY =
  STORAGE_KEYS?.TOKEN ||
  "farmcast.auth.token";
const REFRESH_TOKEN_KEY =
  STORAGE_KEYS?.REFRESH_TOKEN ||
  "farmcast.auth.refreshToken";
const USER_STORAGE_KEY =
  STORAGE_KEYS?.USER ||
  "farmcast.auth.user";

let refreshPromise = null;
const ACCESS_TOKEN_REFRESH_LEEWAY_MS = 30 * 1000;

/* ======================================================
   AXIOS INSTANCE
====================================================== */

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

const readRefreshToken = () => {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
};

const storeRefreshToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
      return;
    }
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // ignore storage write failures
  }
};

const clearSessionStorage = () => {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // ignore storage write failures
  }
};

const notifySessionExpired = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("farmcast:auth-expired")
  );
};

const isAuthEndpointRequest = (url) => {
  const requestUrl = String(url || "");
  return (
    requestUrl.includes("/auth/login") ||
    requestUrl.includes("/auth/register") ||
    requestUrl.includes("/auth/refresh") ||
    requestUrl.includes("/auth/logout")
  );
};

const decodeBase64Url = (value) => {
  try {
    const normalized = String(value || "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const padded = normalized.padEnd(
      Math.ceil(normalized.length / 4) * 4,
      "="
    );
    return atob(padded);
  } catch {
    return null;
  }
};

const parseTokenExpiryMs = (token) => {
  if (typeof token !== "string") {
    return null;
  }

  const segments = token.split(".");
  if (segments.length !== 3) {
    return null;
  }

  const payloadText = decodeBase64Url(segments[1]);
  if (!payloadText) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadText);
    const expSeconds = Number(payload?.exp);
    if (!Number.isFinite(expSeconds) || expSeconds <= 0) {
      return null;
    }
    return expSeconds * 1000;
  } catch {
    return null;
  }
};

const shouldRefreshTokenBeforeRequest = (token) => {
  if (!token) {
    return true;
  }

  const expiresAtMs = parseTokenExpiryMs(token);
  if (!expiresAtMs) {
    return false;
  }

  return (
    Date.now() >=
    expiresAtMs - ACCESS_TOKEN_REFRESH_LEEWAY_MS
  );
};

const buildCorrelationId = () => {
  if (
    typeof globalThis.crypto?.randomUUID ===
    "function"
  ) {
    return `fc-${globalThis.crypto.randomUUID()}`;
  }

  return `fc-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 10)}`;
};

const refreshAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = readRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const response = await axios.post(
        ENDPOINTS.AUTH_REFRESH,
        { refreshToken },
        {
          timeout: REQUEST_TIMEOUT,
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
        }
      );

      const payload = response?.data;
      const data =
        payload &&
        typeof payload === "object" &&
        Object.prototype.hasOwnProperty.call(
          payload,
          "data"
        )
          ? payload.data
          : payload;

      const nextAccessToken = data?.token;
      const nextRefreshToken = data?.refreshToken;

      if (!nextAccessToken) {
        return null;
      }

      setAuthToken(nextAccessToken);
      storeRefreshToken(nextRefreshToken || refreshToken);
      return nextAccessToken;
    } catch {
      clearSessionStorage();
      notifySessionExpired();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/* ======================================================
   REQUEST INTERCEPTOR
====================================================== */

api.interceptors.request.use(
  async (config) => {
    config.headers = config.headers || {};
    const requestUrl = String(config?.url || "");
    const isAuthEndpoint =
      isAuthEndpointRequest(requestUrl);

    try {
      let token =
        localStorage.getItem(AUTH_TOKEN_KEY);

      const hasRefreshToken = Boolean(
        readRefreshToken()
      );

      if (
        !isAuthEndpoint &&
        hasRefreshToken &&
        shouldRefreshTokenBeforeRequest(token)
      ) {
        const nextToken =
          await refreshAccessToken();
        if (nextToken) {
          token = nextToken;
        }
      }

      if (token) {
        config.headers.Authorization =
          `Bearer ${token}`;
      }
    } catch {
      // ignore storage access failures
    }

    // Correlation ID
    if (!config.headers["X-Correlation-ID"]) {
      config.headers["X-Correlation-ID"] =
        buildCorrelationId();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ======================================================
   RESPONSE INTERCEPTOR
====================================================== */

api.interceptors.response.use(
  (response) => {
    const payload = response?.data;

    if (
      payload &&
      typeof payload === "object" &&
      Object.prototype.hasOwnProperty.call(
        payload,
        "data"
      ) &&
      Object.prototype.hasOwnProperty.call(
        payload,
        "success"
      )
    ) {
      return {
        success: payload.success === true,
        data: payload.data,
        status:
          payload.status ?? response.status,
        meta: payload.meta,
        correlationId: payload.correlationId,
      };
    }

    return {
      success: true,
      data: payload,
      status: response.status,
    };
  },

  async (error) => {
    const status =
      error?.response?.status || 500;

    const config = error?.config || {};
    const isAuthEndpoint =
      isAuthEndpointRequest(config?.url);
    const suppressConsoleError = Boolean(
      config?.__suppressConsoleError
    );

    if (
      status === 401 &&
      !config.__retry401 &&
      !isAuthEndpoint
    ) {
      config.__retry401 = true;

      const nextAccessToken =
        await refreshAccessToken();

      if (nextAccessToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${nextAccessToken}`;
        return api(config);
      }
    }

    const isTransient =
      !error.response ||
      [502, 503, 504].includes(status);

    if (isTransient && !config.__retry) {
      config.__retry = true;
      return api(config);
    }

    const normalized = {
      success: false,
      status,
      message:
        error?.response?.data?.message ||
        "Unexpected server error",
      code:
        error?.response?.data?.code ||
        "API_ERROR",
      correlationId:
        error?.response?.headers?.[
          "x-correlation-id"
        ],
    };

    if (
      ENV?.NODE_ENV === "development" &&
      !suppressConsoleError
    ) {
      console.error(
        "API ERROR:",
        normalized
      );
    }

    return Promise.reject(normalized);
  }
);

/* ======================================================
   AUTH TOKEN HELPERS
====================================================== */

export const setAuthToken = (token) => {
  try {
    if (token) {
      localStorage.setItem(
        AUTH_TOKEN_KEY,
        token
      );
    } else {
      localStorage.removeItem(
        AUTH_TOKEN_KEY
      );
    }
  } catch {
    // ignore storage write failures
  }
};

export const getAuthToken = () => {
  try {
    return localStorage.getItem(
      AUTH_TOKEN_KEY
    );
  } catch {
    return null;
  }
};

export const clearAuthToken = () => {
  try {
    localStorage.removeItem(
      AUTH_TOKEN_KEY
    );
    localStorage.removeItem(
      REFRESH_TOKEN_KEY
    );
  } catch {
    // ignore storage write failures
  }
};

/* ======================================================
   HEALTH CHECK
====================================================== */

export const pingApi = async () => {
  try {
    const root = ENV?.API_ROOT_URL || "http://localhost:5000";
    const res = await axios.get(`${root}/health`);
    return res?.data;
  } catch {
    return null;
  }
};

/* ======================================================
   EXPORT
====================================================== */

export default api;
