"use strict";

const bcrypt = require("bcrypt");







const SALT_ROUNDS = 12;



const assertNonEmptyString = (value, label) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
};








const hashPassword = async (plainValue) => {
  assertNonEmptyString(plainValue, "Password");
  return bcrypt.hash(plainValue, SALT_ROUNDS);
};







const comparePassword = async (plainValue, hashedValue) => {
  assertNonEmptyString(plainValue, "Password");
  assertNonEmptyString(hashedValue, "Hashed password");

  return bcrypt.compare(plainValue, hashedValue);
};



module.exports = {
  hashPassword,
  comparePassword,
};
