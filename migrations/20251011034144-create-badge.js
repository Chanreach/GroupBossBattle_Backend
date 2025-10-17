export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "badges",
      {
        id: {
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          type: Sequelize.UUID,
        },
        name: {
          allowNull: false,
          type: Sequelize.STRING,
        },
        image: {
          allowNull: true,
          type: Sequelize.STRING,
        },
        description: {
          allowNull: true,
          type: Sequelize.STRING,
        },
        code: {
          allowNull: false,
          type: Sequelize.STRING,
        },
        type: {
          allowNull: false,
          type: Sequelize.ENUM("milestone", "achievement"),
        },
        threshold: {
          allowNull: true,
          type: Sequelize.INTEGER,
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
    await queryInterface.dropTable("badges");
  },
};
