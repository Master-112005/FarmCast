"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("community_posts", {
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

      caption: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      image_path: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addIndex(
      "community_posts",
      ["user_id"],
      {
        name: "community_posts_user_idx",
      }
    );

    await queryInterface.addIndex(
      "community_posts",
      ["created_at"],
      {
        name: "community_posts_created_idx",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("community_posts");
  },
};
