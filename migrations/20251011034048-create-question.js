export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "questions",
      {
        id: {
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          type: Sequelize.UUID,
        },
        category_id: {
          allowNull: false,
          type: Sequelize.UUID,
          references: {
            model: "categories",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        question_text: {
          allowNull: false,
          type: Sequelize.STRING,
        },
        time_limit: {
          allowNull: false,
          defaultValue: 30,
          type: Sequelize.INTEGER,
        },
        author_id: {
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
    await queryInterface.dropTable("Questions");
  },
};
