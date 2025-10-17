export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "bosses",
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
          allowNull: false,
          type: Sequelize.STRING,
        },
        description: {
          allowNull: true,
          type: Sequelize.TEXT,
        },
        cooldown_duration: {
          allowNull: false,
          defaultValue: 60,
          type: Sequelize.INTEGER,
        },
        number_of_teams: {
          allowNull: false,
          defaultValue: 2,
          type: Sequelize.INTEGER,
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
    await queryInterface.dropTable("bosses");
  },
};
