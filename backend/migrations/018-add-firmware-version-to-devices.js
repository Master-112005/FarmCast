"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(
      "devices"
    );

    if (!table.firmware_version) {
      await queryInterface.addColumn(
        "devices",
        "firmware_version",
        {
          type: Sequelize.STRING(64),
          allowNull: true,
        }
      );
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable(
      "devices"
    );

    if (table.firmware_version) {
      await queryInterface.removeColumn(
        "devices",
        "firmware_version"
      );
    }
  },
};

