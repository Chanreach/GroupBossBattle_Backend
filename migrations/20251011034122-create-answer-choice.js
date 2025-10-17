export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "answer_choices",
      {
        id: {
          allowNull: false,
          autoIncrement: true,
          primaryKey: true,
          type: Sequelize.INTEGER,
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
        choice_text: {
          allowNull: false,
          type: Sequelize.STRING,
        },
        is_correct: {
          allowNull: false,
          defaultValue: false,
          type: Sequelize.BOOLEAN,
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
