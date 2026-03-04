"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("devices");

    if (!table.crop_id) {
      await queryInterface.addColumn("devices", "crop_id", {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    if (!table.moisture_min_threshold) {
      await queryInterface.addColumn(
        "devices",
        "moisture_min_threshold",
        {
          type: Sequelize.FLOAT,
          allowNull: true,
        }
      );
    }

    if (!table.moisture_max_threshold) {
      await queryInterface.addColumn(
        "devices",
        "moisture_max_threshold",
        {
          type: Sequelize.FLOAT,
          allowNull: true,
        }
      );
    }

    if (!table.is_online) {
      await queryInterface.addColumn("devices", "is_online", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    try {
      await queryInterface.addConstraint("devices", {
        fields: ["crop_id"],
        type: "foreign key",
        name: "devices_crop_id_fk",
        references: {
          table: "crops",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      });
    } catch (_error) {
      // Ignore duplicate constraint errors for idempotent runs.
    }

    try {
      await queryInterface.addIndex("devices", ["crop_id"], {
        name: "devices_crop_id_idx",
      });
    } catch (_error) {
      // Ignore duplicate index errors.
    }

    try {
      await queryInterface.addIndex(
        "devices",
        ["is_online", "last_seen_at"],
        { name: "devices_online_last_seen_idx" }
      );
    } catch (_error) {
      // Ignore duplicate index errors.
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("devices");

    try {
      await queryInterface.removeConstraint(
        "devices",
        "devices_crop_id_fk"
      );
    } catch (_error) {
      // Ignore if constraint does not exist.
    }

    try {
      await queryInterface.removeIndex(
        "devices",
        "devices_crop_id_idx"
      );
    } catch (_error) {
      // Ignore if index does not exist.
    }

    try {
      await queryInterface.removeIndex(
        "devices",
        "devices_online_last_seen_idx"
      );
    } catch (_error) {
      // Ignore if index does not exist.
    }

    if (table.is_online) {
      await queryInterface.removeColumn("devices", "is_online");
    }

    if (table.moisture_max_threshold) {
      await queryInterface.removeColumn(
        "devices",
        "moisture_max_threshold"
      );
    }

    if (table.moisture_min_threshold) {
      await queryInterface.removeColumn(
        "devices",
        "moisture_min_threshold"
      );
    }

    if (table.crop_id) {
      await queryInterface.removeColumn("devices", "crop_id");
    }
  },
};
