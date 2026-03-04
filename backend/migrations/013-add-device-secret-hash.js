"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(
      "devices"
    );

    if (!table.device_secret_hash) {
      await queryInterface.addColumn(
        "devices",
        "device_secret_hash",
        {
          type: Sequelize.STRING(255),
          allowNull: true,
        }
      );
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable(
      "devices"
    );

    if (table.device_secret_hash) {
      await queryInterface.removeColumn(
        "devices",
        "device_secret_hash"
      );
    }
  },
};

