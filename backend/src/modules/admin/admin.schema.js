/**
 * src/modules/admin/admin.schema.js
 * ------------------------------------------------------
 * Admin Validation Schemas
 */

"use strict";

const Joi = require("joi");

const deleteAdminUserSchema = Joi.object({
  message: Joi.string().trim().min(5).max(2000).required(),
}).required();

module.exports = {
  deleteAdminUserSchema,
};
