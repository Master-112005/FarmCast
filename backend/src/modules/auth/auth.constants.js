/**
 * src/modules/auth/auth.constants.js
 * ------------------------------------------------------
 * Authentication Domain Constants
 *
 * CRITICAL FILE (AUTH INVARIANTS)
 *
 * Responsibilities:
 * - Centralize auth-related constants
 * - Prevent magic strings across auth controllers/services
 * - Lock down limits & flow semantics
 *
 * Rules:
 * - NO runtime logic
 * - NO environment variables
 * - NO imports from controllers/services
 * - IMMUTABLE exports only
 */

"use strict";

/* ======================================================
   AUTH FLOWS
====================================================== */

/**
 * Supported authentication actions
 * Used for auditing, logging, and future analytics
 */
const AUTH_ACTIONS = Object.freeze({
  REGISTER: "register",
  LOGIN: "login",
  LOGOUT: "logout",
  REFRESH: "refresh",
});

/* ======================================================
   CREDENTIAL POLICIES
====================================================== */

/**
 * Password policy (enforced at schema/service layer)
 * Kept here to avoid drift across modules
 */
const PASSWORD_POLICY = Object.freeze({
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
});

/* ======================================================
   TOKEN CONTEXT
====================================================== */

/**
 * Token types handled by the auth domain
 * (semantic reference only)
 */
const TOKEN_TYPES = Object.freeze({
  ACCESS: "access",
  REFRESH: "refresh",
});

/* ======================================================
   SESSION & SECURITY LIMITS
====================================================== */

/**
 * Limits to protect auth endpoints from abuse
 * (rate-limit middleware uses its own config;
 * these are semantic guards inside auth logic)
 */
const AUTH_LIMITS = Object.freeze({
  MAX_ACTIVE_SESSIONS_PER_USER: 10, // multi-device support
});

/* ======================================================
   AUTH-SPECIFIC ERROR CODES
====================================================== */

/**
 * Auth-domain error codes.
 * These complement (not replace) global ERROR_CODES.
 */
const AUTH_ERRORS = Object.freeze({
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
});

/* ======================================================
   EXPORTS (IMMUTABLE)
====================================================== */

module.exports = Object.freeze({
  AUTH_ACTIONS,
  PASSWORD_POLICY,
  TOKEN_TYPES,
  AUTH_LIMITS,
  AUTH_ERRORS,
});
