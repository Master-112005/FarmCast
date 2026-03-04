/**
 * src/modules/chat/chat.controller.js
 * ------------------------------------------------------
 * Chat Controller
 */

"use strict";

const chatService = require("./chat.service");
const response = require("../../utils/response");

const getContacts = async (req, res, next) => {
  try {
    const contacts =
      await chatService.getContacts(req.user);
    return response.success(res, contacts);
  } catch (err) {
    next(err);
  }
};

const getMessages = async (req, res, next) => {
  try {
    const result = await chatService.getMessages(
      req.user,
      req.query.with,
      req.query.limit
    );
    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const message = await chatService.sendMessage(
      req.user,
      req.body.to,
      req.body.text
    );

    return response.created(res, message);
  } catch (err) {
    next(err);
  }
};

const deleteThread = async (req, res, next) => {
  try {
    const result = await chatService.deleteThread(
      req.user,
      req.params.withUserId
    );

    return response.success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getContacts,
  getMessages,
  sendMessage,
  deleteThread,
};
