export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "answer_choices",
      {
        id: {
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          type: Sequelize.UUID,
        },
        question_id: {
          allowNull: false,
          type: Sequelize.UUID,
          references: {
            model: "questions",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        text: {
          allowNull: false,
          type: Sequelize.STRING,
        },
        is_correct: {
          allowNull: false,
          defaultValue: false,
          type: Sequelize.BOOLEAN,
        },
        order: {
          allowNull: false,
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
    await queryInterface.dropTable("answer_choices");
  },
};
