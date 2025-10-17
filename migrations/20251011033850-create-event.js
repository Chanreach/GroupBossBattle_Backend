export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "events",
      {
        id: {
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          type: Sequelize.UUID,
        },
        name: {
          allowNull: false,
          unique: true,
          type: Sequelize.STRING,
        },
        description: {
          allowNull: true,
          type: Sequelize.TEXT,
        },
        start_at: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        end_at: {
          allowNull: false,
          type: Sequelize.DATE,
        },
        status: {
          allowNull: false,
          defaultValue: "upcoming",
          type: Sequelize.ENUM("upcoming", "ongoing", "completed"),
        },
        creator_id: {
          allowNull: true,
          type: Sequelize.UUID,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
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
    await queryInterface.dropTable("events");
  },
};
