"use strict";

const Joi = require("joi");
const {
  PASSWORD_POLICY,
} = require("./auth.constants");



const email = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .required()
  .messages({
    "string.email": "Invalid email address",
    "any.required": "Email is required",
  });

const password = Joi.string()
  .min(PASSWORD_POLICY.MIN_LENGTH)
  .max(PASSWORD_POLICY.MAX_LENGTH)
  .required()
  .messages({
    "string.min": `Password must be at least ${PASSWORD_POLICY.MIN_LENGTH} characters`,
    "string.max": `Password must be at most ${PASSWORD_POLICY.MAX_LENGTH} characters`,
    "any.required": "Password is required",
  });






const registerSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .required()
    .messages({
      "string.min":
        "Name must be at least 2 characters",
      "any.required": "Name is required",
    }),

  email,

  password,
}).required();






const loginSchema = Joi.object({
  email,
  password,
}).required();






const refreshSchema = Joi.object({
  refreshToken: Joi.string()
    .min(20)
    .required()
    .messages({
      "any.required":
        "Refresh token is required",
    }),
}).required();



module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
