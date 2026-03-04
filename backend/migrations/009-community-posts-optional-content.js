/**
 * migrations/009-community-posts-optional-content.js
 * ------------------------------------------------------
 * Allow caption-only or image-only community posts
 */

"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn(
      "community_posts",
      "caption",
      {
        type: Sequelize.STRING(500),
        allowNull: true,
      }
    );

    await queryInterface.changeColumn(
      "community_posts",
      "image_path",
      {
        type: Sequelize.STRING(255),
        allowNull: true,
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE community_posts
      SET caption = ''
      WHERE caption IS NULL
    `);

    await queryInterface.sequelize.query(`
      UPDATE community_posts
      SET image_path = ''
      WHERE image_path IS NULL
    `);

    await queryInterface.changeColumn(
      "community_posts",
      "caption",
      {
        type: Sequelize.STRING(500),
        allowNull: false,
      }
    );

    await queryInterface.changeColumn(
      "community_posts",
      "image_path",
      {
        type: Sequelize.STRING(255),
        allowNull: false,
      }
    );
  },
};
