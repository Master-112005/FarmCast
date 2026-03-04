"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables)
      ? tables.map((entry) =>
          typeof entry === "string"
            ? entry
            : entry?.tableName || entry?.table_name
        )
      : [];

    if (!tableNames.includes("crops")) {
      await queryInterface.createTable("crops", {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4,
        },
        name: {
          type: Sequelize.STRING(120),
          allowNull: false,
        },
        moisture_min_threshold: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
        moisture_max_threshold: {
          type: Sequelize.FLOAT,
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
    }

    try {
      await queryInterface.addIndex("crops", ["name"], {
        name: "crops_name_idx",
      });
    } catch (_error) {
      // Ignore duplicate index errors for idempotent runs.
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables)
      ? tables.map((entry) =>
          typeof entry === "string"
            ? entry
            : entry?.tableName || entry?.table_name
        )
      : [];

    if (tableNames.includes("crops")) {
      await queryInterface.dropTable("crops");
    }
  },
};
