/**
 * src/modules/users/user.schema.js
 * ------------------------------------------------------
 * User Domain Validation Schemas
 *
 * CRITICAL FILE (USER INPUT CONTRACT)
 *
 * Responsibilities:
 * - Validate user-related request payloads
 * - Protect profile endpoints from invalid input
 * - Prevent privilege escalation via request payloads
 *
 * Rules:
 * - NO business logic
 * - NO database access
 * - NO environment variables
 *
 * If this file is wrong → user data integrity breaks
 */

"use strict";

const Joi = require("joi");
const { USER_LIMITS } = require("./user.constants");

/* ======================================================
   COMMON FIELD SCHEMAS
====================================================== */

const name = Joi.string()
  .min(USER_LIMITS.MIN_NAME_LENGTH)
  .max(USER_LIMITS.MAX_NAME_LENGTH)
  .trim()
  .messages({
    "string.min": `Name must be at least ${USER_LIMITS.MIN_NAME_LENGTH} characters`,
    "string.max": `Name must be at most ${USER_LIMITS.MAX_NAME_LENGTH} characters`,
  });

const email = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .trim()
  .messages({
    "string.email": "Invalid email address",
  });

const phone = Joi.string()
  .pattern(/^[0-9]{7,15}$/)
  .messages({
    "string.pattern.base":
      "Phone must be 7-15 digits",
  });

const address = Joi.string()
  .max(500)
  .messages({
    "string.max":
      "Address must be at most 500 characters",
  });

const fieldSize = Joi.number()
  .min(0)
  .messages({
    "number.base":
      "Field size must be a number",
    "number.min":
      "Field size cannot be negative",
  });

const profileImage = Joi.string()
  .uri()
  .messages({
    "string.uri":
      "Profile image must be a valid URL",
  });

/* ======================================================
   USER SELF-PROFILE UPDATE
====================================================== */

/**
 * PUT /api/v1/users/me
 *
 * USER is allowed to update:
 * - name
 * - email
 *
 * Explicitly disallowed:
 * - role
 * - isActive
 * - password
 */
const updateMyProfileSchema = Joi.object({
  name,
  email,
  phone: phone.allow("", null),
  address: address.allow("", null),
  fieldSize: fieldSize.allow(null),
  profileImage: profileImage.allow("", null),
})
  .min(1)
  .required()
  .messages({
    "object.min":
      "At least one profile field must be provided",
  });

/* ======================================================
   EXPORTS
====================================================== */

module.exports = {
  updateMyProfileSchema,
};
