export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "event_bosses",
      {
        id: {
          allowNull: false,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          type: Sequelize.UUID,
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
        boss_id: {
          allowNull: false,
          type: Sequelize.UUID,
          references: {
            model: "bosses",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "RESTRICT",
        },
        join_code: {
          allowNull: false,
          unique: true,
          type: Sequelize.STRING,
        },
        status: {
          allowNull: false,
          defaultValue: "pending",
          type: Sequelize.ENUM("pending", "active", "in-battle", "cooldown"),
        },
        cooldown_duration: {
          allowNull: false,
          defaultValue: 60,
          type: Sequelize.INTEGER,
        },
        number_of_teams: {
          allowNull: false,
          type: Sequelize.INTEGER,
          defaultValue: 2,
        },
        cooldown_end_at: {
          allowNull: true,
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
    await queryInterface.dropTable("event_bosses");
  },
};
