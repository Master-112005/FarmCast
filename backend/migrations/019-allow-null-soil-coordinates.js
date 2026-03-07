"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(
      "soil_records"
    );

    if (table.latitude) {
      await queryInterface.changeColumn(
        "soil_records",
        "latitude",
        {
          type: Sequelize.DECIMAL(10, 6),
          allowNull: true,
        }
      );
    }

    if (table.longitude) {
      await queryInterface.changeColumn(
        "soil_records",
        "longitude",
        {
          type: Sequelize.DECIMAL(10, 6),
          allowNull: true,
        }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DELETE FROM soil_records
      WHERE latitude IS NULL OR longitude IS NULL
    `);

    await queryInterface.changeColumn(
      "soil_records",
      "latitude",
      {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: false,
      }
    );

    await queryInterface.changeColumn(
      "soil_records",
      "longitude",
      {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: false,
      }
    );
  },
};

