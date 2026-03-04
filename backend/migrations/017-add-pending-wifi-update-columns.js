"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(
      "devices"
    );
    const indexes = await queryInterface.showIndex(
      "devices"
    );
    const hasPendingWifiRequestedAtIndex =
      Array.isArray(indexes) &&
      indexes.some((index) =>
        Array.isArray(index.fields) &&
        index.fields.some(
          (field) =>
            field?.attribute ===
            "pending_wifi_requested_at"
        )
      );

    if (!table.pending_wifi_ssid) {
      await queryInterface.addColumn(
        "devices",
        "pending_wifi_ssid",
        {
          type: Sequelize.STRING(64),
          allowNull: true,
        }
      );
    }

    if (!table.pending_wifi_password) {
      await queryInterface.addColumn(
        "devices",
        "pending_wifi_password",
        {
          type: Sequelize.STRING(64),
          allowNull: true,
        }
      );
    }

    if (!table.pending_wifi_requested_at) {
      await queryInterface.addColumn(
        "devices",
        "pending_wifi_requested_at",
        {
          type: Sequelize.DATE,
          allowNull: true,
        }
      );
    }

    if (!hasPendingWifiRequestedAtIndex) {
      await queryInterface.addIndex("devices", [
        "pending_wifi_requested_at",
      ]);
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable(
      "devices"
    );
    const indexes = await queryInterface.showIndex(
      "devices"
    );
    const hasPendingWifiRequestedAtIndex =
      Array.isArray(indexes) &&
      indexes.some((index) =>
        Array.isArray(index.fields) &&
        index.fields.some(
          (field) =>
            field?.attribute ===
            "pending_wifi_requested_at"
        )
      );

    if (hasPendingWifiRequestedAtIndex) {
      await queryInterface.removeIndex("devices", [
        "pending_wifi_requested_at",
      ]);
    }

    if (table.pending_wifi_requested_at) {
      await queryInterface.removeColumn(
        "devices",
        "pending_wifi_requested_at"
      );
    }

    if (table.pending_wifi_password) {
      await queryInterface.removeColumn(
        "devices",
        "pending_wifi_password"
      );
    }

    if (table.pending_wifi_ssid) {
      await queryInterface.removeColumn(
        "devices",
        "pending_wifi_ssid"
      );
    }
  },
};

