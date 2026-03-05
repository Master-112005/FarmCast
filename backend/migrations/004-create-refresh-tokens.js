"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("refresh_tokens", {
      

      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      

      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      

      token: {
        type: Sequelize.STRING(255), // HMAC-safe
        allowNull: false,
        comment:
          "Hashed refresh token (HMAC; never store raw token)",
      },

      is_revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      

      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },

      user_agent: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      expires_at: {
        type: Sequelize.DATE,
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

    

    await queryInterface.addIndex("refresh_tokens", [
      "user_id",
    ]);

    await queryInterface.addIndex("refresh_tokens", [
      "expires_at",
    ]);

    await queryInterface.addIndex("refresh_tokens", [
      "is_revoked",
    ]);

    await queryInterface.addIndex("refresh_tokens", [
      "token",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("refresh_tokens");
  },
};
