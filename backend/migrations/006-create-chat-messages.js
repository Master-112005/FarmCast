/**
 * migrations/006-create-chat-messages.js
 * ------------------------------------------------------
 * Create Chat Messages Table
 */

"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("chat_messages", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      recipient_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex("chat_messages", [
      "sender_id",
    ]);

    await queryInterface.addIndex("chat_messages", [
      "recipient_id",
    ]);

    await queryInterface.addIndex("chat_messages", [
      "created_at",
    ]);

    await queryInterface.addIndex(
      "chat_messages",
      ["sender_id", "recipient_id", "created_at"],
      {
        name: "chat_messages_thread_idx",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("chat_messages");
  },
};
