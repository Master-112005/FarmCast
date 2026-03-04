"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("soil_records");

    if (!table.longitude) {
      await queryInterface.addColumn("soil_records", "longitude", {
        type: Sequelize.DECIMAL(10, 6),
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      DELETE FROM soil_records
      WHERE latitude IS NULL
         OR longitude IS NULL
         OR latitude < -90
         OR latitude > 90
         OR longitude < -180
         OR longitude > 180
         OR (ABS(latitude) < 0.000001 AND ABS(longitude) < 0.000001)
    `);

    await queryInterface.changeColumn("soil_records", "latitude", {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: false,
    });

    await queryInterface.changeColumn("soil_records", "longitude", {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: false,
    });

    const indexes = await queryInterface.showIndex("soil_records");
    const hasDeviceIndex = indexes.some((index) =>
      index.name === "soil_records_device_id_idx" ||
      index.fields.some((field) => field.attribute === "device_id")
    );
    const hasCreatedAtIndex = indexes.some((index) =>
      index.name === "soil_records_created_at_idx" ||
      index.fields.some((field) => field.attribute === "created_at")
    );

    if (!hasDeviceIndex) {
      await queryInterface.addIndex("soil_records", ["device_id"], {
        name: "soil_records_device_id_idx",
      });
    }

    if (!hasCreatedAtIndex) {
      await queryInterface.addIndex("soil_records", ["created_at"], {
        name: "soil_records_created_at_idx",
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      "soil_records",
      "soil_records_created_at_idx"
    ).catch(() => {});
    await queryInterface.removeIndex(
      "soil_records",
      "soil_records_device_id_idx"
    ).catch(() => {});

    await queryInterface.changeColumn("soil_records", "latitude", {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: true,
    });

    await queryInterface.changeColumn("soil_records", "longitude", {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: true,
    });
  },
};
