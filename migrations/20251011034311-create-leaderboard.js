export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "leaderboards",
      {
        id: {
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          type: Sequelize.UUID,
        },
        user_id: {
          allowNull: false,
          type: Sequelize.UUID,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        event_boss_id: {
          allowNull: false,
          type: Sequelize.UUID,
          references: {
            model: "event_bosses",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        event_id: {
          allowNull: false,
          type: Sequelize.UUID,
          references: {
            model: "events",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        total_damage_dealt: {
          allowNull: false,
          defaultValue: 0,
          type: Sequelize.DOUBLE,
        },
        total_correct_answers: {
          allowNull: false,
          defaultValue: 0,
          type: Sequelize.INTEGER,
        },
        total_questions_answered: {
          allowNull: false,
          defaultValue: 0,
          type: Sequelize.INTEGER,
        },
        total_battles_participated: {
          allowNull: false,
          defaultValue: 0,
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
    await queryInterface.dropTable("leaderboards");
  },
};
