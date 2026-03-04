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

    if (!tableNames.includes("alerts")) {
      await queryInterface.createTable("alerts", {
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
        type: {
          type: Sequelize.ENUM(
            "MOISTURE_LOW",
            "MOISTURE_HIGH",
            "DEVICE_OFFLINE"
          ),
          allowNull: false,
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        value: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
        threshold: {
          type: Sequelize.FLOAT,
          allowNull: true,
        },
        resolved: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
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
      await queryInterface.addIndex("alerts", ["user_id"], {
        name: "alerts_user_id_idx",
      });
    } catch (_error) {
      // Ignore duplicate index errors.
    }

    try {
      await queryInterface.addIndex("alerts", ["device_id"], {
        name: "alerts_device_id_idx",
      });
    } catch (_error) {
      // Ignore duplicate index errors.
    }

    try {
      await queryInterface.addIndex("alerts", ["resolved"], {
        name: "alerts_resolved_idx",
      });
    } catch (_error) {
      // Ignore duplicate index errors.
    }

    try {
      await queryInterface.addIndex(
        "alerts",
        ["device_id", "type", "resolved"],
        {
          name: "alerts_device_type_resolved_idx",
        }
      );
    } catch (_error) {
      // Ignore duplicate index errors.
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

    if (tableNames.includes("alerts")) {
      await queryInterface.dropTable("alerts");
    }
  },
};
