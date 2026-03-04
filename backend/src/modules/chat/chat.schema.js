/**
 * src/modules/chat/chat.schema.js
 * ------------------------------------------------------
 * Chat Validation Schemas
 */

"use strict";

const Joi = require("joi");

const userId = Joi.string()
  .guid({ version: ["uuidv4", "uuidv5"] })
  .messages({
    "string.guid": "User ID must be a UUID",
  });

const chatMessagesQuerySchema = Joi.object({
  with: userId.optional(),
  limit: Joi.number().integer().min(1).max(200).default(100),
}).required();

const sendChatMessageSchema = Joi.object({
  to: userId.required().messages({
    "any.required": "Recipient user ID is required",
  }),
  text: Joi.string().trim().min(1).max(2000).required().messages({
    "string.empty": "Message cannot be empty",
    "string.max": "Message must be at most 2000 characters",
  }),
}).required();

const chatThreadParamsSchema = Joi.object({
  withUserId: userId.required().messages({
    "any.required": "Peer user ID is required",
  }),
}).required();

module.exports = {
  chatMessagesQuerySchema,
  sendChatMessageSchema,
  chatThreadParamsSchema,
};
