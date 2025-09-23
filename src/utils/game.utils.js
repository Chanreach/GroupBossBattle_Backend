import { GAME_CONSTANTS } from "./game.constants.js";
import RandomGenerator from "./random-generator.js";
import { generateSeed } from "./generate-seed.js";

export const initializePlayerStats = () => {
  return {
    hearts: GAME_CONSTANTS.PLAYER_STARTING_HEARTS || 3,
    totalDamage: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    questionsAnswered: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
    accuracy: 0,
  };
};

export const initializeTeamStats = () => {
  return {
    totalDamage: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    questionsAnswered: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
    accuracy: 0,
  };
};

export const calculateBossHP = (numberOfPlayers, numberOfTeams) => {
  const calculatedHP = Math.max(
    GAME_CONSTANTS.MINIMUM_HP_THRESHOLD,
    numberOfPlayers * GAME_CONSTANTS.HP_SCALING_PER_PLAYER
  );

  if (numberOfTeams > 2) {
    calculatedHP *=
      1 + (numberOfTeams - 2) * GAME_CONSTANTS.TEAM_SCALING_FACTOR;
  }

  return Math.floor(calculatedHP);
};

export const getResponseTimeCategory = (responseTime, questionTimeLimit) => {
  const timeRatio = responseTime / questionTimeLimit;

  let category;
  if (timeRatio <= GAME_CONSTANTS.RESPONSE_TIME_THRESHOLDS.FAST) {
    category = "FAST";
  } else if (timeRatio <= GAME_CONSTANTS.RESPONSE_TIME_THRESHOLDS.NORMAL) {
    category = "NORMAL";
  } else {
    category = "SLOW";
  }

  return category;
};

export const getDamageMultiplier = (responseTime, questionTimeLimit) => {
  const category = getResponseTimeCategory(responseTime, questionTimeLimit);
  return GAME_CONSTANTS.DAMAGE_MULTIPLIERS[category];
};

export const calculateDamage = (isCorrect, responseTime, questionTimeLimit) => {
  if (!isCorrect) {
    return {
      damage: 0,
      responseCategory: "INCORRECT",
    };
  }
  return {
    damage:
      GAME_CONSTANTS.BASE_DAMAGE *
      getDamageMultiplier(responseTime, questionTimeLimit),
    responseCategory: getResponseTimeCategory(responseTime, questionTimeLimit),
  };
};

export const generateRevivalCode = (battleSessionId, playerId, length = 6) => {
  const seed = generateSeed([battleSessionId, playerId, new Date()]);
  const rng = new RandomGenerator(seed);

  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
  let result = "";

  for (let i = 0; i < length; i++) {
    result += characters.charAt(rng.getRandomInt(0, characters.length - 1));
  }

  return result;
};

export const generateUniqueRevivalCode = (
  battleSessionId,
  playerId,
  existingCodes,
  maxAttempts = 100
) => {
  const existingSet =
    existingCodes instanceof Set ? existingCodes : new Set(existingCodes);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const newCode = generateRevivalCode(battleSessionId, playerId);
    if (!existingSet.has(newCode)) {
      return newCode;
    }
  }

  throw new Error("Unable to generate a unique revival code");
};

export const generateBattleSessionId = (eventBossId) => {
  const timestamp = Date.now();
  const rng = new RandomGenerator();
  const randomSuffix = rng.getRandomInt(0, 9999).toString().padStart(4, "0");
  return `${eventBossId}-${timestamp}-${randomSuffix}`;
};
