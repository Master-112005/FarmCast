"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_logs", {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      event_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      actor_type: {
        type: Sequelize.ENUM(
          "user",
          "device",
          "system"
        ),
        allowNull: false,
      },
      actor_id: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      target_device_id: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    await queryInterface.addIndex("audit_logs", [
      "event_type",
    ]);
    await queryInterface.addIndex("audit_logs", [
      "actor_type",
    ]);
    await queryInterface.addIndex("audit_logs", [
      "target_device_id",
    ]);
    await queryInterface.addIndex("audit_logs", [
      "timestamp",
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("audit_logs");
  },
};
