/**
 * src/modules/chat/chat.service.js
 * ------------------------------------------------------
 * Chat Domain Service
 */

"use strict";

const { Op } = require("sequelize");
const db = require("../../models");
const { ERROR_CODES } = require("../../utils/constants");

const domainError = (
  code,
  message,
  status = 400
) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const getActiveUserById = async (userId) => {
  const user = await db.User.findByPk(userId, {
    attributes: [
      "id",
      "name",
      "email",
      "role",
      "isActive",
    ],
  });

  if (!user || !user.isActive) {
    throw domainError(
      ERROR_CODES.RESOURCE_NOT_FOUND,
      "User not found",
      404
    );
  }

  return user;
};

const getActivePeers = async (
  excludeId,
  limit = null
) => {
  const where = {
    isActive: true,
    id: { [Op.ne]: excludeId },
  };

  const options = {
    where,
    attributes: ["id", "name", "email", "role"],
    order: [
      ["name", "ASC"],
      ["createdAt", "ASC"],
    ],
  };

  if (Number.isFinite(limit) && limit > 0) {
    options.limit = limit;
  }

  return db.User.findAll(options);
};

const assertChatAllowed = (
  currentUser,
  peer
) => {
  if (currentUser.id === peer.id) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "You cannot chat with yourself",
      400
    );
  }
};

const resolvePeer = async (
  currentUser,
  requestedUserId = null
) => {
  if (requestedUserId) {
    const peer = await getActiveUserById(
      requestedUserId
    );
    assertChatAllowed(currentUser, peer);
    return peer;
  }

  const peers = await getActivePeers(
    currentUser.id,
    1
  );

  if (!peers.length) {
    throw domainError(
      ERROR_CODES.RESOURCE_NOT_FOUND,
      "No users available for chat",
      404
    );
  }

  return peers[0];
};

const mapContact = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const toIsoOrNull = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const getContactChatMeta = async (
  currentUserId,
  contactId
) => {
  const latestMessage = await db.ChatMessage.findOne({
    where: {
      [Op.or]: [
        {
          senderId: currentUserId,
          recipientId: contactId,
        },
        {
          senderId: contactId,
          recipientId: currentUserId,
        },
      ],
    },
    attributes: [
      "id",
      "senderId",
      "message",
      "createdAt",
    ],
    order: [["createdAt", "DESC"]],
  });

  const latestIncoming = await db.ChatMessage.findOne({
    where: {
      senderId: contactId,
      recipientId: currentUserId,
    },
    attributes: ["id", "message", "createdAt"],
    order: [["createdAt", "DESC"]],
  });

  return {
    lastMessageAt: toIsoOrNull(
      latestMessage?.createdAt
    ),
    lastMessagePreview:
      latestMessage?.message || null,
    lastMessageFrom:
      latestMessage?.senderId || null,
    latestIncomingId:
      latestIncoming?.id || null,
    latestIncomingAt: toIsoOrNull(
      latestIncoming?.createdAt
    ),
    latestIncomingMessage:
      latestIncoming?.message || null,
  };
};

const mapContactWithMeta = (
  user,
  meta = {}
) => ({
  ...mapContact(user),
  ...meta,
});

const mapMessage = (message) => ({
  id: message.id,
  from: message.senderId,
  to: message.recipientId,
  text: message.message,
  createdAt: message.createdAt,
});

const getContacts = async (currentUser) => {
  const peers = await getActivePeers(
    currentUser.id
  );

  const contacts = await Promise.all(
    peers.map(async (peer) => {
      const meta = await getContactChatMeta(
        currentUser.id,
        peer.id
      );
      return mapContactWithMeta(peer, meta);
    })
  );

  return contacts.sort((a, b) => {
    const aTime = a.lastMessageAt
      ? new Date(a.lastMessageAt).getTime()
      : 0;
    const bTime = b.lastMessageAt
      ? new Date(b.lastMessageAt).getTime()
      : 0;

    if (aTime !== bTime) {
      return bTime - aTime;
    }

    return String(a.name || a.email || "").localeCompare(
      String(b.name || b.email || ""),
      undefined,
      { sensitivity: "base" }
    );
  });
};

const getMessages = async (
  currentUser,
  withUserId,
  limit = 100
) => {
  const peer = await resolvePeer(
    currentUser,
    withUserId
  );

  const safeLimit = Math.min(
    Math.max(Number(limit) || 100, 1),
    200
  );

  const rows = await db.ChatMessage.findAll({
    where: {
      [Op.or]: [
        {
          senderId: currentUser.id,
          recipientId: peer.id,
        },
        {
          senderId: peer.id,
          recipientId: currentUser.id,
        },
      ],
    },
    order: [["createdAt", "DESC"]],
    limit: safeLimit,
  });

  return {
    withUser: mapContact(peer),
    messages: rows.reverse().map(mapMessage),
  };
};

const sendMessage = async (
  currentUser,
  toUserId,
  text
) => {
  const peer = await resolvePeer(
    currentUser,
    toUserId
  );

  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "Message cannot be empty",
      400
    );
  }

  const message = await db.ChatMessage.create({
    senderId: currentUser.id,
    recipientId: peer.id,
    message: trimmed,
  });

  return mapMessage(message);
};

const deleteThread = async (
  currentUser,
  withUserId
) => {
  const peer = await resolvePeer(
    currentUser,
    withUserId
  );

  const deletedCount = await db.ChatMessage.destroy({
    where: {
      [Op.or]: [
        {
          senderId: currentUser.id,
          recipientId: peer.id,
        },
        {
          senderId: peer.id,
          recipientId: currentUser.id,
        },
      ],
    },
  });

  return {
    withUser: mapContact(peer),
    deletedCount,
  };
};

module.exports = {
  getContacts,
  getMessages,
  sendMessage,
  deleteThread,
};
