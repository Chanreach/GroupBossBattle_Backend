export default {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(
      "boss_categories",
      {
        boss_id: {
          allowNull: false,
          type: Sequelize.UUID,
          references: {
            model: "bosses",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
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
    await queryInterface.dropTable("boss_categories");
  },
};
