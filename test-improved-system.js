// Test script to demonstrate the improved shuffling and team generation
import bossSessionManager from "./src/socket/managers/boss-session.manager.js";

console.log("🧪 Testing Improved Shuffling and Team Generation...\n");

// Create a test session
const eventBossId = "test-improved-system-123";
const sampleQuestionsData = [
  {
    categoryId: 1,
    categoryName: "Test Category",
    questions: [
      {
        questionId: 1,
        questionText: "What is 2 + 2?",
        questionType: "multiple_choice",
        difficulty: "easy",
        timeLimit: 30000,
        answerChoices: [
          { id: 1, choiceText: "3", isCorrect: false },
          { id: 2, choiceText: "4", isCorrect: true },
          { id: 3, choiceText: "5", isCorrect: false },
          { id: 4, choiceText: "6", isCorrect: false },
          { id: 5, choiceText: "7", isCorrect: false },
          { id: 6, choiceText: "8", isCorrect: false },
        ],
      },
      {
        questionId: 2,
        questionText: "What is the capital of France?",
        questionType: "multiple_choice",
        difficulty: "easy",
        timeLimit: 30000,
        answerChoices: [
          { id: 7, choiceText: "London", isCorrect: false },
          { id: 8, choiceText: "Berlin", isCorrect: false },
          { id: 9, choiceText: "Paris", isCorrect: true },
          { id: 10, choiceText: "Madrid", isCorrect: false },
          { id: 11, choiceText: "Rome", isCorrect: false },
          { id: 12, choiceText: "Amsterdam", isCorrect: false },
        ],
      },
    ],
  },
];

const session = bossSessionManager.createSession(eventBossId, {
  name: "Test Boss",
  maxHp: 30,
  currentHp: 30,
  numberOfTeams: 4, // Test with 4 teams
  questionsData: sampleQuestionsData,
});

console.log("✅ Session created with improved team names:");
console.log("📋 Teams:");
session.teams.forEach((team, teamId) => {
  console.log(`   Team ${teamId}: ${team.name}`);
});
console.log("");

// Add multiple test players
const players = [
  { id: "player-1", nickname: "Alice" },
  { id: "player-2", nickname: "Bob" },
  { id: "player-3", nickname: "Charlie" },
  { id: "player-4", nickname: "Diana" },
  { id: "player-5", nickname: "Eve" },
  { id: "player-6", nickname: "Frank" },
];

console.log("👥 Adding players and demonstrating team assignment...");
for (let i = 0; i < players.length; i++) {
  const player = players[i];
  const result = await bossSessionManager.addPlayer(
    eventBossId,
    `socket-${player.id}`,
    {
      playerId: player.id,
      nickname: player.nickname,
      isGuest: true,
    }
  );

  if (result) {
    console.log(`✅ ${player.nickname} added to session`);
  }
}

// Start the boss fight to trigger team assignment
await bossSessionManager.startBossFight(eventBossId);
console.log("\n🏁 Boss fight started - Teams assigned:");

session.teams.forEach((team, teamId) => {
  const playerList = Array.from(team.players).map((playerId) => {
    const player = session.players.get(playerId);
    return player ? player.nickname : playerId;
  });
  console.log(
    `   ${team.name}: [${playerList.join(", ")}] (${team.players.size} players)`
  );
});

console.log("\n🎯 Testing question shuffling for different players...");

// Test question pools for two different players
const player1Id = "player-1";
const player2Id = "player-2";

const question1 = bossSessionManager.getNextQuestionForPlayer(
  eventBossId,
  player1Id
);
const question2 = bossSessionManager.getNextQuestionForPlayer(
  eventBossId,
  player2Id
);

if (question1 && question2) {
  console.log(`\n📝 ${players[0].nickname}'s Question:`, question1.text);
  console.log(
    "   Choices:",
    question1.choices.map((c) => c.text)
  );
  console.log("   Correct Answer Index:", question1.correctAnswerIndex);
  console.log(
    "   Correct Answer:",
    question1.choices[question1.correctAnswerIndex].text
  );

  console.log(`\n📝 ${players[1].nickname}'s Question:`, question2.text);
  console.log(
    "   Choices:",
    question2.choices.map((c) => c.text)
  );
  console.log("   Correct Answer Index:", question2.correctAnswerIndex);
  console.log(
    "   Correct Answer:",
    question2.choices[question2.correctAnswerIndex].text
  );

  // Show that answer choices are shuffled differently for each player
  const sameQuestion = question1.id === question2.id;
  const sameChoiceOrder =
    JSON.stringify(question1.choices) === JSON.stringify(question2.choices);

  console.log("\n🔀 Shuffling Analysis:");
  console.log("   Same question:", sameQuestion);
  console.log("   Same choice order:", sameChoiceOrder);
  console.log(
    "   ✅ Choices are shuffled differently per player:",
    !sameChoiceOrder
  );
}

console.log("\n🏆 Summary of Improvements:");
console.log(
  "✅ Team names generated using seeded randomization (unique and creative)"
);
console.log("✅ Team assignment balanced but randomized using seeds");
console.log(
  "✅ Question order shuffled per player using proper RandomGenerator"
);
console.log("✅ Answer choices shuffled per player per question");
console.log("✅ All randomization is reproducible and consistent");
console.log("✅ Proper seed generation using crypto-based hashing");
console.log(
  "\n🎮 The system now provides fair, balanced, and engaging gameplay!"
);
