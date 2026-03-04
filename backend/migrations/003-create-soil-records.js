"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("soil_records", {
      /* ======================================================
         PRIMARY KEY
      ====================================================== */

      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      /* ======================================================
         DEVICE OWNERSHIP
      ====================================================== */

      device_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: "devices",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

      /* ======================================================
         TELEMETRY METRICS
      ====================================================== */

      moisture: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
      },

      temperature: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
      },

      latitude: {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
      },

      battery: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },

      /* ======================================================
         TIMESTAMPS
      ====================================================== */

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    /* ======================================================
       INDEXES
    ====================================================== */

    await queryInterface.addIndex("soil_records", ["device_id"]);
    await queryInterface.addIndex("soil_records", ["user_id"]);
    await queryInterface.addIndex("soil_records", ["created_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("soil_records");
  },
};