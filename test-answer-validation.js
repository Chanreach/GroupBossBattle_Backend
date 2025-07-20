// Test script to verify answer validation fix
import bossSessionManager from "./src/socket/managers/boss-session.manager.js";

console.log("🧪 Testing answer validation fix...");

// Create a test session
const eventBossId = "test-validation-123";
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
        ],
      },
    ],
  },
];

const session = bossSessionManager.createSession(eventBossId, {
  name: "Test Boss",
  maxHp: 10,
  currentHp: 10,
  numberOfTeams: 2,
  questionsData: sampleQuestionsData,
});

console.log("✅ Session created:", !!session);

// Add a test player
const playerId = "test-player-123";
const result = await bossSessionManager.addPlayer(eventBossId, "socket-123", {
  playerId: playerId,
  nickname: "Test Player",
  isGuest: true,
});

console.log("✅ Player added:", !!result);

// Start the boss fight
await bossSessionManager.startBossFight(eventBossId);
console.log("✅ Boss fight started");

// Get a question for the player
const questionData = bossSessionManager.getNextQuestionForPlayer(
  eventBossId,
  playerId
);
console.log("✅ Question received:", !!questionData);

if (questionData) {
  console.log("📝 Question:", questionData.text);
  console.log("📋 Choices:", questionData.choices);
  console.log("✔️ Correct Answer Index:", questionData.correctAnswerIndex);
  console.log(
    "✔️ Correct Answer Text:",
    questionData.choices[questionData.correctAnswerIndex]
  );

  // Test the validation logic
  const choiceIndex = questionData.correctAnswerIndex;
  const isCorrect =
    parseInt(choiceIndex) === parseInt(questionData.correctAnswerIndex);

  console.log("🎯 Validation Test:");
  console.log(
    "   Player choice:",
    choiceIndex,
    "(type:",
    typeof choiceIndex,
    ")"
  );
  console.log(
    "   Correct answer:",
    questionData.correctAnswerIndex,
    "(type:",
    typeof questionData.correctAnswerIndex,
    ")"
  );
  console.log("   Is correct:", isCorrect);

  if (isCorrect) {
    console.log(
      "✅ VALIDATION PASSED: Answer validation is working correctly!"
    );
  } else {
    console.log("❌ VALIDATION FAILED: Answer validation is still broken!");
  }
} else {
  console.log("❌ No question data received");
}
