/**
 * src/modules/community/community.schema.js
 * ------------------------------------------------------
 * Community Validation Schemas
 */

"use strict";

const Joi = require("joi");

const listCommunityPostsQuerySchema = Joi.object({
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(50),
}).required();

const createCommunityPostSchema = Joi.object({
  caption: Joi.string()
    .trim()
    .max(500)
    .allow("")
    .optional(),
}).required();

const communityPostParamsSchema = Joi.object({
  postId: Joi.string()
    .guid({
      version: ["uuidv4", "uuidv5"],
    })
    .required()
    .messages({
      "any.required": "Post ID is required",
      "string.guid": "Post ID must be a UUID",
    }),
}).required();

module.exports = {
  listCommunityPostsQuerySchema,
  createCommunityPostSchema,
  communityPostParamsSchema,
};
