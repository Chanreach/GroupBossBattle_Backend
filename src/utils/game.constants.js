export const GAME_CONSTANTS = {
  MINIMUM_HP_THRESHOLD: 30,
  HP_SCALING_PER_PLAYER: 15,
  TEAM_SCALING_FACTOR: 0.2,

  MINIMUM_PLAYERS_REQUIRED: 2,

  BASE_DAMAGE: 1,
  DAMAGE_MULTIPLIERS: {
    FAST: 1.5,
    NORMAL: 1.0,
    SLOW: 0.5,
  },

  RESPONSE_TIME_THRESHOLDS: {
    FAST: 0.33,
    NORMAL: 0.66,
    SLOW: 1.0,
  },
};

export const getResponseTimeCategory = (responseTime, questionTimeLimit) => {
  // Convert questionTimeLimit from seconds to milliseconds for proper comparison
  const timeLimitMs = questionTimeLimit * 1000;
  const timeRatio = responseTime / timeLimitMs;

  // Debug logging for response time categorization
  console.log(
    "📊 =============== RESPONSE TIME CATEGORY DEBUG ==============="
  );
  console.log(
    `⚡ Response Time: ${responseTime}ms (${(responseTime / 1000).toFixed(2)}s)`
  );
  console.log(`⏱️  Time Limit: ${questionTimeLimit}s (${timeLimitMs}ms)`);
  console.log(
    `📈 Time Ratio: ${responseTime}ms ÷ ${timeLimitMs}ms = ${timeRatio.toFixed(
      3
    )}`
  );
  console.log(
    `🎯 Thresholds: FAST ≤ ${GAME_CONSTANTS.RESPONSE_TIME_THRESHOLDS.FAST}, NORMAL ≤ ${GAME_CONSTANTS.RESPONSE_TIME_THRESHOLDS.NORMAL}`
  );

  let category;
  if (timeRatio <= GAME_CONSTANTS.RESPONSE_TIME_THRESHOLDS.FAST) {
    category = "FAST";
  } else if (timeRatio <= GAME_CONSTANTS.RESPONSE_TIME_THRESHOLDS.NORMAL) {
    category = "NORMAL";
  } else {
    category = "SLOW";
  }

  console.log(
    `🏆 Result: ${category} (${(timeRatio * 100).toFixed(
      1
    )}% of time limit used)`
  );
  console.log(
    "📊 ============================================================="
  );

  return category;
};

export const createTeamAssignmentSeed = (
  bossSessionId,
  eventBossId,
  roomCode,
  joinCode,
  numberOfTeams,
  numberOfPlayers,
  playerOrder = 0
) => {
  const timestamp = Date.now();
  const input = `${bossSessionId}_${eventBossId}_${roomCode}_${joinCode}_teams${numberOfTeams}_players${numberOfPlayers}_order${playerOrder}_${timestamp}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

export const createQuestionSelectionSeed = (
  bossSessionId,
  eventBossId,
  roomCode,
  joinCode,
  numberOfTeams,
  numberOfPlayers,
  categoryId = 0
) => {
  const timestamp = Date.now();
  const input = `${bossSessionId}_${eventBossId}_${roomCode}_${joinCode}_teams${numberOfTeams}_players${numberOfPlayers}_questions_cat${categoryId}_${timestamp}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};

export const createRevivalCodeSeed = (
  bossSessionId,
  eventBossId,
  roomCode,
  joinCode,
  numberOfTeams,
  numberOfPlayers,
  playerId
) => {
  const timestamp = Date.now();
  const input = `${bossSessionId}_${eventBossId}_${roomCode}_${joinCode}_teams${numberOfTeams}_players${numberOfPlayers}_revival_${playerId}_${timestamp}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
};
