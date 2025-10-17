export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "users",
      {
        id: {
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          type: Sequelize.UUID,
        },
        username: {
          allowNull: false,
          unique: true,
          type: Sequelize.STRING,
        },
        profile_image: {
          allowNull: true,
          type: Sequelize.STRING,
        },
        email: {
          allowNull: true,
          unique: true,
          type: Sequelize.STRING,
        },
        password: {
          allowNull: true,
          type: Sequelize.STRING,
        },
        role: {
          allowNull: false,
          defaultValue: "player",
          type: Sequelize.ENUM("player", "host", "admin", "superadmin"),
        },
        is_guest: {
          defaultValue: false,
          type: Sequelize.BOOLEAN,
        },
        last_active_at: {
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
          type: Sequelize.DATE,
        },
        created_at: {
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
          type: Sequelize.DATE,
        },
        updated_at: {
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
          type: Sequelize.DATE,
        },
      },
      {
        charset: "utf8mb4",
        collate: "utf8mb4_general_ci",
      }
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("users");
  },
};
