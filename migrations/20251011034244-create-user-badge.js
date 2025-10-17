export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "user_badges",
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
        badge_id: {
          allowNull: false,
          type: Sequelize.UUID,
          references: {
            model: "badges",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        event_boss_id: {
          allowNull: true,
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
        earned_at: {
          allowNull: false,
          defaultValue: Sequelize.NOW,
          type: Sequelize.DATE,
        },
        is_redeemed: {
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
    await queryInterface.dropTable("user_badges");
  },
};
