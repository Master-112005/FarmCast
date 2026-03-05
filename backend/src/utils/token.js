"use strict";

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const env = require("../config/env");
const logger = require("./logger");
const {
  ERROR_CODES,
  HTTP_STATUS,
} = require("./constants");



if (!env?.AUTH?.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET is not configured"
  );
}

if (!env?.AUTH?.JWT_EXPIRES_IN) {
  throw new Error(
    "JWT_EXPIRES_IN is not configured"
  );
}

if (!env?.AUTH?.REFRESH_TOKEN_EXPIRES_IN) {
  throw new Error(
    "REFRESH_TOKEN_EXPIRES_IN is not configured"
  );
}

if (!env?.AUTH?.REFRESH_TOKEN_SECRET) {
  throw new Error(
    "REFRESH_TOKEN_SECRET is not configured"
  );
}



const buildPayload = (user) => ({
  sub: user.id,
  role: user.role,
});

const jwtOptions = Object.freeze({
  issuer: env.AUTH.JWT_ISSUER,
  audience: env.AUTH.JWT_AUDIENCE,
  algorithm: env.AUTH.JWT_ALGORITHM,
});



const generateAccessToken = (user) => {
  if (!user?.id || !user?.role) {
    throw new Error(
      "Invalid user data for access token"
    );
  }

  return jwt.sign(
    buildPayload(user),
    env.AUTH.JWT_SECRET,
    {
      expiresIn: env.AUTH.JWT_EXPIRES_IN,
      issuer: jwtOptions.issuer,
      audience: jwtOptions.audience,
      algorithm: jwtOptions.algorithm,
    }
  );
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(
      token,
      env.AUTH.JWT_SECRET,
      {
        issuer: jwtOptions.issuer,
        audience: jwtOptions.audience,
        algorithms: [jwtOptions.algorithm],
      }
    );
  } catch (error) {
    logger.warn("JWT verification failed", {
      message: error.message,
    });

    const err = new Error("Invalid access token");
    err.code = ERROR_CODES.AUTH_REQUIRED;
    err.status = HTTP_STATUS.UNAUTHORIZED;
    throw err;
  }
};



const generateRefreshToken = () => {
  return crypto
    .randomBytes(64)
    .toString("hex");
};

const hashRefreshToken = (token) => {
  if (!token) {
    throw new Error("Refresh token is required");
  }

  return crypto
    .createHmac("sha256", env.AUTH.REFRESH_TOKEN_SECRET)
    .update(token)
    .digest("hex");
};



const getRefreshTokenExpiry = () => {
  const now = new Date();
  const value =
    env.AUTH.REFRESH_TOKEN_EXPIRES_IN;

  if (
    typeof value === "string" &&
    value.endsWith("d")
  ) {
    const days = parseInt(value, 10);
    now.setDate(now.getDate() + days);
    return now;
  }

  const days = parseInt(value, 10);
  now.setDate(now.getDate() + days);
  return now;
};



module.exports = Object.freeze({
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  hashRefreshToken,
});
