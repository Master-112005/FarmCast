/**
 * constants.js
 * Enterprise-grade Frontend Configuration
 * Single source of truth for API contracts & UI constants
 *
 * CRITICAL FILE
 * If this file is wrong → frontend cannot talk to backend
 */

/* ======================================================
   ENVIRONMENT
====================================================== */

export const ENV = Object.freeze({
  NODE_ENV: ["development", "production", "test"].includes(
    import.meta.env.MODE
  )
    ? import.meta.env.MODE
    : "development",

  API_BASE_URL:
    import.meta.env.VITE_API_BASE_URL ||
    "http://localhost:5000/api",

  API_ROOT_URL:
    import.meta.env.VITE_API_ROOT_URL ||
    (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(
      /\/api\/?$/,
      ""
    ),
});

/* ======================================================
   API VERSIONING
====================================================== */

export const API_VERSION = "v1";

/* ======================================================
   API BASE
====================================================== */

export const API_BASE = `${ENV.API_BASE_URL}/${API_VERSION}`;

/* ======================================================
   ENDPOINTS (CANONICAL CONTRACT)
====================================================== */

export const ENDPOINTS = Object.freeze({
  /* ---------- AUTH ---------- */
  AUTH_REGISTER: `${API_BASE}/auth/register`,
  AUTH_LOGIN: `${API_BASE}/auth/login`,
  AUTH_REFRESH: `${API_BASE}/auth/refresh`,
  AUTH_LOGOUT: `${API_BASE}/auth/logout`,

  /* ---------- USERS ---------- */
  USERS_ME: `${API_BASE}/users/me`,

  /* ---------- ADMIN (OPTIONAL) ---------- */
  ADMIN_USERS: `${API_BASE}/admin/users`,
  ADMIN_OVERVIEW: `${API_BASE}/admin/overview`,

  /* ---------- CHAT ---------- */
  CHAT: `${API_BASE}/chat`,

  /* ---------- COMMUNITY ---------- */
  COMMUNITY: `${API_BASE}/community`,

  /* ---------- DEVICES ---------- */
  DEVICES: `${API_BASE}/devices`,
  SOIL: `${API_BASE}/soil`,

  /* ---------- ML / ANALYTICS ---------- */
  PREDICTORS: `${API_BASE}/predictors`,
});

/* ======================================================
   UPLOAD & REQUEST LIMITS
====================================================== */

export const LIMITS = Object.freeze({
  IMAGE_MAX_SIZE_MB: 5,
  ALLOWED_IMAGE_TYPES: [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/webp",
  ],
  REQUEST_TIMEOUT_MS: 15_000,
  ML_IMAGE_TIMEOUT_MS: 30_000,
});

/* ======================================================
   FEATURE FLAGS
====================================================== */

export const FEATURES = Object.freeze({
  ENABLE_DEVICE_MAP: true,
  ENABLE_ML_UPLOAD: true,
  ENABLE_MOCK_DATA: false,
});

/* ======================================================
   UI CONSTANTS
====================================================== */

export const UI = Object.freeze({
  DEFAULT_PAGE_SIZE: 10,
  DATE_FORMAT: "YYYY-MM-DD",

  THEME: {
    PRIMARY_COLOR: "#16a34a",
    SECONDARY_COLOR: "#2563eb",
    ERROR_COLOR: "#dc2626",
  },

  BREAKPOINTS: {
    MOBILE: 640,
    TABLET: 768,
    DESKTOP: 1024,
    XL: 1280,
  },
});

/* ======================================================
   GEOGRAPHY (ML SAFE CATEGORIES)
====================================================== */

export const STATES = [
  "Andhra Pradesh",
  "Telangana",
];

export const DISTRICTS = {
  "Andhra Pradesh": [
    "Anantapur",
    "Chittoor",
    "Cuddapah",
    "East Godavari",
    "Guntur",
    "Krishna",
    "Kurnool",
    "Nellore",
    "Palnadu",
    "Prakasam",
    "Srikakulam",
    "Vijayanagaram",
    "Visakhapatnam",
    "West Godavari",
  ],
  Telangana: [
    "Adilabad",
    "Bhadradri Kothagudem",
    "Hyderabad",
    "Jagityal",
    "Karimnagar",
    "Khammam",
    "Mahbubnagar",
    "Medak",
    "Nalgonda",
    "Nizamabad",
    "Rajanna Siricilla",
    "Ranga Reddy",
    "Warangal",
  ],
};

/* ======================================================
   STORAGE KEYS (AUTH CRITICAL)
====================================================== */

export const STORAGE_KEYS = Object.freeze({
  AUTH_TOKEN: "farmcast.auth.token",
  TOKEN: "farmcast.auth.token",
  REFRESH_TOKEN: "farmcast.auth.refreshToken",
  USER: "farmcast.auth.user",
  ROLE: "farmcast_user_role",
  DEVICE_ID: "farmcast_device_id",
  LAST_LOGIN: "farmcast_last_login",
});
