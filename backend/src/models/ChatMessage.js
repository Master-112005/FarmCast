/**
 * src/models/ChatMessage.js
 * ------------------------------------------------------
 * Chat Message Model
 */

"use strict";

module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define(
    "ChatMessage",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      senderId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      recipientId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
    },
    {
      tableName: "chat_messages",
      timestamps: true,
      indexes: [
        { fields: ["sender_id"] },
        { fields: ["recipient_id"] },
        { fields: ["created_at"] },
      ],
    }
  );

  return ChatMessage;
};
