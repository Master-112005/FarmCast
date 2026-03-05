"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
      

      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      

      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      email: {
        type: Sequelize.STRING(150),
        allowNull: false,
        unique: true,
      },

      password: {
        type: Sequelize.STRING(255), // bcrypt-safe length
        allowNull: false,
      },

      

      role: {
        type: Sequelize.ENUM("user", "admin"),
        allowNull: false,
        defaultValue: "user",
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      

      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },

      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      field_size: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },

      profile_image: {
        type: Sequelize.STRING(255),
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

      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    

    await queryInterface.addIndex("users", ["email"], {
      unique: true,
      name: "users_email_uq",
    });

    await queryInterface.addIndex("users", ["role"], {
      name: "users_role_idx",
    });

    await queryInterface.addIndex("users", ["is_active"], {
      name: "users_active_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("users");
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_users_role";'
    );
  },
};
