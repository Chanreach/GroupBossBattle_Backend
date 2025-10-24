import { csQuestions } from "../src/utils/seeds/questions.seed.js";
import { prepareSeedQuestions } from "../src/utils/seeds/seed-helper.js";

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
      const categoryId = await queryInterface.rawSelect(
        "categories",
        {
          where: {
            name: "CS",
          },
        },
        ["id"]
      );
      if (!superadminId) {
        throw new Error(
          "Superadmin user not found. Please run the superadmin seeder first."
        );
      }
      if (!categoryId) {
        throw new Error(
          'Category "CS" not found. Please run the categories seeder first.'
        );
      }

      const { seededQuestions, seededAnswerChoices } = prepareSeedQuestions(
        csQuestions,
        categoryId,
        superadminId
      );

      await queryInterface.bulkInsert("questions", seededQuestions, {});
      await queryInterface.bulkInsert(
        "answer_choices",
        seededAnswerChoices,
        {}
      );
    } catch (error) {
      console.error("Seeding questions and answer choices error:", error);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("questions", null, {});
    await queryInterface.bulkDelete("answer_choices", null, {});
  },
};
