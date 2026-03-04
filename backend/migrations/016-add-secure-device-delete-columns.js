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
    const hasDeletionPendingIndex =
      Array.isArray(indexes) &&
      indexes.some((index) =>
        Array.isArray(index.fields) &&
        index.fields.some(
          (field) =>
            field?.attribute ===
            "deletion_pending"
        )
      );

    if (
      table.user_id &&
      table.user_id.allowNull === false
    ) {
      await queryInterface.changeColumn(
        "devices",
        "user_id",
        {
          type: Sequelize.UUID,
          allowNull: true,
        }
      );
    }

    if (!table.deletion_pending) {
      await queryInterface.addColumn(
        "devices",
        "deletion_pending",
        {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        }
      );
    }

    if (!table.deletion_pending_at) {
      await queryInterface.addColumn(
        "devices",
        "deletion_pending_at",
        {
          type: Sequelize.DATE,
          allowNull: true,
        }
      );
    }

    if (!hasDeletionPendingIndex) {
      await queryInterface.addIndex("devices", [
        "deletion_pending",
      ]);
    }
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable(
      "devices"
    );
    const indexes = await queryInterface.showIndex(
      "devices"
    );
    const hasDeletionPendingIndex =
      Array.isArray(indexes) &&
      indexes.some((index) =>
        Array.isArray(index.fields) &&
        index.fields.some(
          (field) =>
            field?.attribute ===
            "deletion_pending"
        )
      );

    if (hasDeletionPendingIndex) {
      await queryInterface.removeIndex("devices", [
        "deletion_pending",
      ]);
    }

    if (table.deletion_pending_at) {
      await queryInterface.removeColumn(
        "devices",
        "deletion_pending_at"
      );
    }

    if (table.deletion_pending) {
      await queryInterface.removeColumn(
        "devices",
        "deletion_pending"
      );
    }

    if (table.user_id) {
      await queryInterface.changeColumn(
        "devices",
        "user_id",
        {
          type: Sequelize.UUID,
          allowNull: false,
        }
      );
    }
  },
};
