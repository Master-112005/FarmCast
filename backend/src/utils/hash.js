"use strict";

const bcrypt = require("bcrypt");



/**
 * bcrypt cost factor
 * 12 = strong security + good performance for SaaS
 */
const SALT_ROUNDS = 12;



const assertNonEmptyString = (value, label) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
};



/**
 * Hash a sensitive value
 * @param {string} plainValue
 * @returns {Promise<string>}
 */
const hashPassword = async (plainValue) => {
  assertNonEmptyString(plainValue, "Password");
  return bcrypt.hash(plainValue, SALT_ROUNDS);
};

/**
 * Compare raw value against bcrypt hash
 * @param {string} plainValue
 * @param {string} hashedValue
 * @returns {Promise<boolean>}
 */
const comparePassword = async (plainValue, hashedValue) => {
  assertNonEmptyString(plainValue, "Password");
  assertNonEmptyString(hashedValue, "Hashed password");

  return bcrypt.compare(plainValue, hashedValue);
};



module.exports = {
  hashPassword,
  comparePassword,
};
