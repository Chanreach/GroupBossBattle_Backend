import { v4 as uuidv4 } from "uuid";

export default {
  async up(queryInterface, Sequelize) {
    try {
      const superadminId = await queryInterface.rawSelect(
        "users",
        {
          where: {
            username: "superadmin",
          },
        },
        ["id"]
      );
      if (!superadminId) {
        throw new Error(
          "Superadmin user not found. Please run the superadmin seeder first."
        );
      }
      await queryInterface.bulkInsert(
        "categories",
        [
          {
            id: uuidv4(),
            name: "CS",
            creator_id: superadminId,
          },
        ],
        {}
      );
    } catch (error) {
      console.error("Seeding categories error:", error);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("categories", null, {});
  },
};
