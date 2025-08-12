// ===== SOCKET CONSTANTS ===== //

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
  },

  // ===== BATTLE QUEUE EVENTS ===== //
  BATTLE_QUEUE: {
    JOIN: "battle-queue:join",
    LEAVE: "battle-queue:leave",
    
    JOINED: "battle-queue:joined",
    LEFT: "battle-queue:left",
  },

  // ===== BOSS BATTLE EVENTS ===== //
  BOSS_BATTLE: {
    START: "boss-battle:start",

    JOIN: "boss-battle:join",
    LEAVE: "boss-battle:leave",

    JOINED: "boss-battle:joined",
    LEFT: "boss-battle:left",
  },

  // ===== NICKNAME EVENTS ===== //
  NICKNAME: {
    
  },

  // ===== BOSS EVENTS ===== //
  BOSS: {
    SPAWN: "boss:spawn",
    DESPAWN: "boss:despawn",
    REQUEST_STATUS: "boss:request_status"
  }
};

// ===== SOCKET ROOMS ===== //
export const SOCKET_ROOMS = {
  BOSS_PREVIEW: (eventBossId) => `boss-preview:${eventBossId}`,
  BATTLE_QUEUE: (eventBattleId) => `battle-queue:${eventBattleId}`,
  BOSS_BATTLE: (eventBossId) => `boss-battle:${eventBossId}`,
};

// ===== SOCKET ERRORS ===== //
export const SOCKET_ERRORS = {
  MISSING_DATA: "Missing required data",
  NOT_FOUND: "Resource not found",
  INTERNAL_SERVER: "Internal server error"
};

// ===== SOCKET MESSAGES ===== //
export const SOCKET_MESSAGES = {
  INVALID_JOIN: "Invalid join attempt.",
  NOT_FOUND_ERROR: "The requested resource was not found.",
  INTERNAL_SERVER_ERROR: "An internal server error occurred. Please try again later."
};
