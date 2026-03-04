/**
 * migrations/007-create-prediction-histories.js
 * ------------------------------------------------------
 * Create Prediction Histories Table
 */

"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("prediction_histories", {
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

      prediction_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "success",
      },

      summary: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      request_id: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },

      input_payload: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      result_payload: {
        type: Sequelize.JSON,
        allowNull: true,
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
      "prediction_histories",
      ["user_id"],
      {
        name: "prediction_histories_user_idx",
      }
    );

    await queryInterface.addIndex(
      "prediction_histories",
      ["prediction_type"],
      {
        name: "prediction_histories_type_idx",
      }
    );

    await queryInterface.addIndex(
      "prediction_histories",
      ["created_at"],
      {
        name: "prediction_histories_created_idx",
      }
    );

    await queryInterface.addIndex(
      "prediction_histories",
      ["user_id", "created_at"],
      {
        name: "prediction_histories_user_created_idx",
      }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("prediction_histories");
  },
};
