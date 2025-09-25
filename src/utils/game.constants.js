export const GAME_CONSTANTS = {
  BATTLE_COUNTDOWN: 5000,
  PODIUM_COUNTDOWN: 3000,

  MINIMUM_HP_THRESHOLD: 30,
  HP_SCALING_PER_PLAYER: 15,
  TEAM_SCALING_FACTOR: 0.2,

  MINIMUM_PLAYERS_REQUIRED: 2,
  PLAYER_STARTING_HEARTS: 3,
  REVIVAL_TIMEOUT: 60000,

  DEFAULT_QUESTION_TIME_LIMIT: 30000,
  ANSWERS_PER_QUESTION: 4,
  MINIMUM_ANSWER_CHOICES: 4,
  TOTAL_ANSWER_CHOICES: 8,

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

  BOSS_STATUS: {
    ACTIVE: "active",
    IN_BATTLE: "in-battle",
    DEFEATED: "defeated",
    COOLDOWN: "cooldown",
  },

  PLAYER: {
    CONTEXT_STATUS: {
      IDLE: "idle",
      IN_QUEUE: "in-queue",
      IN_BATTLE: "in-battle",
      DISCONNECTED: "disconnected",
    },

    BATTLE_STATE: {
      ACTIVE: "active",
      KNOCKED_OUT: "knocked-out",
      REVIVED: "revived",
      DEAD: "dead",
    },
  },

  BATTLE_STATE: {
    ACTIVE: "active",
    IN_PROGRESS: "in-progress",
    ENDED: "ended",
  },

  REVIVAL_CODE: {
    LENGTH: 6,
    EXPIRED: "expired",
    INVALID: "invalid",
  },

  BADGE_CODES: {
    ACHIEVEMENT: {
      MVP: "mvp",
      LAST_HIT: "last-hit",
      BOSS_DEFEATED: "boss-defeated",
      TEAM_VICTORY: "team-victory",
    },
    MILESTONE: {
      QUESTIONS_10: "questions_10",
      QUESTIONS_25: "questions_25",
      QUESTIONS_50: "questions_50",
      QUESTIONS_100: "questions_100",
    },
  },

  MILESTONE_THRESHOLDS: {
    QUESTIONS_10: 10,
    QUESTIONS_25: 25,
    QUESTIONS_50: 50,
    QUESTIONS_100: 100,
  },

  PLAYER_BATTLE_STATE_SCORE: {
    "active": 1,
    "revived": 0.75,
    "knocked-out": 0.5,
    "dead": 0,
  }
};

export const getResponseTimeCategory = (responseTime, questionTimeLimit) => {
  const timeLimitMs = questionTimeLimit * 1000;
  const timeRatio = responseTime / timeLimitMs;

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
