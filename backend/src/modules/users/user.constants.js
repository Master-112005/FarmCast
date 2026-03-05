"use strict";



/**
 * Supported user roles
 * Used by auth, RBAC, services
 */
const USER_ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});



/**
 * Account status flags
 * Used for access control & moderation
 */
const USER_STATUS = Object.freeze({
  ACTIVE: "active",
  DISABLED: "disabled",
});



/**
 * Domain-level limits (semantic guards)
 * DB- and rate-limits live elsewhere
 */
const USER_LIMITS = Object.freeze({
  MAX_NAME_LENGTH: 100,
  MIN_NAME_LENGTH: 2,
});



/**
 * User-specific error codes
 * Complement global ERROR_CODES
 */
const USER_ERRORS = Object.freeze({
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_DISABLED: "USER_DISABLED",
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  INVALID_PROFILE_UPDATE: "INVALID_PROFILE_UPDATE",
});



module.exports = Object.freeze({
  USER_ROLES,
  USER_STATUS,
  USER_LIMITS,
  USER_ERRORS,
});
