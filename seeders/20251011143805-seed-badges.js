import { v4 as uuidv4 } from "uuid";

export default {
  async up(queryInterface, Sequelize) {
    try {
      await queryInterface.bulkInsert(
        "badges",
        [
          {
            id: uuidv4(),
            name: "MVP",
            description:
              "Awarded to a player with the highest total damage dealt during the boss fight, regardless of team outcome.",
            code: "mvp",
            type: "achievement",
            threshold: null,
          },
          {
            id: uuidv4(),
            name: "Last Hit",
            description:
              "Awarded to the player who lands the final blow that defeats the boss.",
            code: "last-hit",
            type: "achievement",
            threshold: null,
          },
          {
            id: uuidv4(),
            name: "Boss Defeated",
            description:
              "Awarded to every player on the team that deals the highest total damage to the boss during the fight.",
            code: "boss-defeated",
            type: "achievement",
            threshold: null,
          },
          {
            id: uuidv4(),
            name: "10 Questions",
            description: "Answer 10 questions correctly during the event.",
            code: "questions_10",
            type: "milestone",
            threshold: 10,
          },
          {
            id: uuidv4(),
            name: "25 Questions",
            description: "Answer 25 questions correctly during the event.",
            code: "questions_25",
            type: "milestone",
            threshold: 25,
          },
          {
            id: uuidv4(),
            name: "50 Questions",
            description: "Answer 50 questions correctly during the event.",
            code: "questions_50",
            type: "milestone",
            threshold: 50,
          },
          {
            id: uuidv4(),
            name: "100 Questions",
            description: "Answer 100 questions correctly during the event.",
            code: "questions_100",
            type: "milestone",
            threshold: 100,
          },
          {
            id: uuidv4(),
            name: "Hero",
            description:
              "Awarded to the player who defeats every boss in the event.",
            code: "hero",
            type: "milestone",
            threshold: null,
          },
        ],
        {}
      );
    } catch (error) {
      console.error("Seeding badges error:", error);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("badges", null, {});
  },
};
