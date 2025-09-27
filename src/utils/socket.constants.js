// ===== SOCKET EVENTS ===== //
export const SOCKET_EVENTS = {
  // ===== CONNECTION EVENTS ===== //
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  ERROR: "error",

  // ===== BOSS PREVIEW EVENTS ===== //
  BOSS_PREVIEW: {
    JOIN: "boss-preview:join",
    LEAVE: "boss-preview:leave",

    JOINED: "boss-preview:joined",
    LEFT: "boss-preview:left",

    LEADERBOARD: {
      REQUEST: "boss-preview:leaderboard-request",
      RESPONSE: "boss-preview:leaderboard-response",
      UPDATED: "boss-preview:leaderboard-updated",
    },
  },

  // ===== BATTLE QUEUE EVENTS ===== //
  BATTLE_QUEUE: {
    JOIN: "battle-queue:join",
    LEAVE: "battle-queue:leave",
    JOINED: "battle-queue:joined",
    LEFT: "battle-queue:left",

    QUEUE_SIZE: {
      REQUEST: "battle-queue:size-request",
      RESPONSE: "battle-queue:size-response",
      UPDATED: "battle-queue:size-updated",
    },
  },

  // ===== BATTLE SESSION EVENTS ===== //
  BATTLE_SESSION: {
    COUNTDOWN: "battle-session:countdown",
    START: "battle-session:start",
    ENDED: "battle-session:ended",

    JOIN: "battle-session:join",
    LEAVE: "battle-session:leave",

    JOINED: "battle-session:joined",
    LEFT: "battle-session:left",

    SIZE: {
      REQUEST: "battle-session:size-request",
      RESPONSE: "battle-session:size-response",
      UPDATED: "battle-session:size-updated",
    },

    MID_GAME: {
      JOIN: "battle-session:mid-game-join",
      LEAVE: "battle-session:mid-game-leave",
      JOINED: "battle-session:mid-game-joined",
      LEFT: "battle-session:mid-game-left",
    },

    QUESTION: {
      REQUEST: "battle-session:question-request",
      NEXT: "battle-session:question-next",
      ANSWER: "battle-session:question-answer",
      TIMEOUT: "battle-session:question-timeout",
    },

    ANSWER: {
      SUBMIT: "battle-session:answer-submit",
      RESULT: "battle-session:answer-result",
    },

    BOSS: {
      DAMAGED: "battle-session:boss-damaged",
      DEFEATED: "battle-session:boss-defeated",
      HP_UPDATED: "battle-session:boss-hp-updated",
    },

    PLAYER: {
      JOINED: "battle-session:player-joined",
      LEFT: "battle-session:player-left",
      RECONNECT: "battle-session:player-reconnect",
      RECONNECTED: "battle-session:player-reconnected",
      RECONNECT_FAILED: "battle-session:player-reconnect-failed",
      NOT_FOUND: "battle-session:player-not-found",

      KNOCKED_OUT: "battle-session:player-knocked-out",
      REVIVED: "battle-session:player-revived",
      DEAD: "battle-session:player-dead",
    },

    TEAMMATE: {
      KNOCKED_OUT: "battle-session:teammate-knocked-out",
      REVIVED: "battle-session:teammate-revived",
      DEAD: "battle-session:teammate-dead",

      KNOCKED_OUT_COUNT: "battle-session:teammate-knocked-out-count",
    },

    REVIVAL_CODE: {
      SUBMIT: "battle-session:revival-code-submit",
      EXPIRED: "battle-session:revival-code-expired",
      EXPIRED_RESPONSE: "battle-session:revival-code-expired-response",
      SUCCESS: "battle-session:revival-code-success",
      FAILURE: "battle-session:revival-code-failure",
    },

    LEADERBOARD: {
      REQUEST: "battle-session:leaderboard-request",
      RESPONSE: "battle-session:leaderboard-response",
      UPDATED: "battle-session:leaderboard-updated",
    },
  },

  // ===== PODIUM EVENTS ===== //
  PODIUM: {
    JOIN: "battle-session:podium-join",
    LEAVE: "battle-session:podium-leave",
    JOINED: "battle-session:podium-joined",
    LEFT: "battle-session:podium-left",
    REQUEST: "battle-session:podium-request",
    RESPONSE: "battle-session:podium-response",
  },

  // ===== BATTLE MONITOR EVENTS ===== //
  BATTLE_MONITOR: {
    JOIN: "battle-monitor:join",
    LEAVE: "battle-monitor:leave",
    JOINED: "battle-monitor:joined",
    LEFT: "battle-monitor:left",
    REQUEST: "battle-monitor:request",
    RESPONSE: "battle-monitor:response",
    UPDATED: "battle-monitor:updated",
  },

  // ===== NICKNAME EVENTS ===== //
  NICKNAME: {
    VALIDATION: "nickname:validation",
  },

  // ===== BOSS EVENTS ===== //
  BOSS: {
    SPAWN: "boss:spawn",
    DESPAWN: "boss:despawn",
    REQUEST_STATUS: "boss:request_status",
  },

  BOSS_STATUS: {
    UPDATE: "boss-status:update",
    UPDATED: "boss-status:updated",
  },

  // ===== BADGE EVENTS ===== //
  BADGE: {
    EARNED: "badge:earned",
  },
};

// ===== SOCKET ROOMS ===== //
export const SOCKET_ROOMS = {
  BOSS_PREVIEW: (eventBossId) => `boss-preview:${eventBossId}`,
  BATTLE_QUEUE: (eventBattleId) => `battle-queue:${eventBattleId}`,
  BATTLE_SESSION: (eventBossId) => `battle-session:${eventBossId}`,
  TEAM: (eventBossId, teamId) => `team:${eventBossId}:${teamId}`,
  PODIUM: (eventBossId) => `podium:${eventBossId}`,
  BATTLE_MONITOR: (eventBossId) => `battle-monitor:${eventBossId}`,
};

// ===== SOCKET ERRORS ===== //
export const SOCKET_ERRORS = {
  MISSING_DATA: "Missing required data",
  NOT_FOUND: "Resource not found",
  INTERNAL_SERVER: "Internal server error",
};

// ===== SOCKET MESSAGES ===== //
export const SOCKET_MESSAGES = {
  INVALID_JOIN: "Invalid join attempt.",
  NOT_FOUND_ERROR: "The requested resource was not found.",
  INTERNAL_SERVER_ERROR:
    "An internal server error occurred. Please try again later.",

  // ===== BATTLE QUEUE MESSAGES ===== //
  BATTLE_QUEUE: {
    JOINED: "Successfully joined the battle queue.",
    LEFT: "Successfully left the battle queue.",
  },

  BADGE_EARNED: {
    "mvp": (playerName) =>
      `Congratulations ${playerName}! You've earned the MVP badge for your outstanding performance!`,
    "last-hit": (playerName) =>
      `Congratulations ${playerName}! You've earned the Last Hit badge for delivering the final blow!`,
    "team-victory": (teamName) =>
      `Congratulations Team ${teamName}! You've earned the Team Victory badge for your collective effort!`,
  },
};
