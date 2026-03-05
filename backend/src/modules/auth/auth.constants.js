"use strict";



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



/**
 * Password policy (enforced at schema/service layer)
 * Kept here to avoid drift across modules
 */
const PASSWORD_POLICY = Object.freeze({
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
});



/**
 * Token types handled by the auth domain
 * (semantic reference only)
 */
const TOKEN_TYPES = Object.freeze({
  ACCESS: "access",
  REFRESH: "refresh",
});



/**
 * Limits to protect auth endpoints from abuse
 * (rate-limit middleware uses its own config;
 * these are semantic guards inside auth logic)
 */
const AUTH_LIMITS = Object.freeze({
  MAX_ACTIVE_SESSIONS_PER_USER: 10, // multi-device support
});



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



module.exports = Object.freeze({
  AUTH_ACTIONS,
  PASSWORD_POLICY,
  TOKEN_TYPES,
  AUTH_LIMITS,
  AUTH_ERRORS,
});
