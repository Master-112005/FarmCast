"use strict";







const AUTH_ACTIONS = Object.freeze({
  REGISTER: "register",
  LOGIN: "login",
  LOGOUT: "logout",
  REFRESH: "refresh",
});







const PASSWORD_POLICY = Object.freeze({
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
});







const TOKEN_TYPES = Object.freeze({
  ACCESS: "access",
  REFRESH: "refresh",
});








const AUTH_LIMITS = Object.freeze({
  MAX_ACTIVE_SESSIONS_PER_USER: 10,
});







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
