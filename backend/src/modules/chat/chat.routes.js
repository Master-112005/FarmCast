"use strict";

const express = require("express");
const {
  authenticate,
} = require("../../middlewares/auth.middleware");
const {
  requireRole,
} = require("../../middlewares/rbac.middleware");
const validate =
  require("../../middlewares/validate.middleware");
const {
  USER_ROLES,
} = require("../users/user.constants");
const {
  chatMessagesQuerySchema,
  sendChatMessageSchema,
  chatThreadParamsSchema,
} = require("./chat.schema");
const chatController = require("./chat.controller");

const router = express.Router();

router.get(
  "/contacts",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  chatController.getContacts
);

router.get(
  "/messages",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ query: chatMessagesQuerySchema }),
  chatController.getMessages
);

router.post(
  "/messages",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ body: sendChatMessageSchema }),
  chatController.sendMessage
);

router.delete(
  "/threads/:withUserId",
  authenticate,
  requireRole(
    USER_ROLES.USER,
    USER_ROLES.ADMIN
  ),
  validate({ params: chatThreadParamsSchema }),
  chatController.deleteThread
);

module.exports = router;
