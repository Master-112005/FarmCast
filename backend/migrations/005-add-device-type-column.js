"use strict";


module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("devices");

    if (!table.type) {
      await queryInterface.addColumn("devices", "type", {
        type: Sequelize.ENUM(
          "soil_sensor",
          "weather_sensor",
          "multi_sensor"
        ),
        allowNull: false,
        defaultValue: "soil_sensor",
      });
    }


    try {
      const indexes = await queryInterface.showIndex("devices");
      const hasTypeIndex = indexes.some((idx) =>
        Array.isArray(idx.fields)
          ? idx.fields.some(
              (field) =>
                field?.attribute === "type" ||
                field?.name === "type"
            )
          : false
      );

      if (!hasTypeIndex) {
        await queryInterface.addIndex("devices", ["type"]);
      }
    } catch {

    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("devices");

    if (table.type) {
      await queryInterface.removeColumn("devices", "type");
    }
  },
};
