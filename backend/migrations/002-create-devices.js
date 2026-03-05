"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("devices", {
      

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

      

      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      type: {
        type: Sequelize.ENUM(
          "soil_sensor",
          "weather_sensor",
          "multi_sensor"
        ),
        allowNull: false,
        defaultValue: "soil_sensor",
      },

      device_code: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
      },

      status: {
        type: Sequelize.ENUM(
          "active",
          "inactive",
          "offline",
          "maintenance"
        ),
        allowNull: false,
        defaultValue: "active",
      },

      

      latitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },

      longitude: {
        type: Sequelize.DECIMAL(10, 7),
        allowNull: true,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      last_seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      

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

    

    await queryInterface.addIndex("devices", [
      "user_id",
    ]);

    await queryInterface.addIndex("devices", [
      "device_code",
    ]);

    await queryInterface.addIndex("devices", [
      "type",
    ]);

    await queryInterface.addIndex("devices", [
      "status",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("devices");
  },
};
