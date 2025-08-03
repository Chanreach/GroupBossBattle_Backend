// ===== SOCKET CONSTANTS ===== //

export const SOCKET_EVENTS = {
  // ===== CONNECTION EVENTS ===== //
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  ERROR: "error",

  // ===== BOSS PREVIEW EVENTS ===== //
  BOSS_PREVIEW: {
    ENTER: "boss-preview:enter",
    EXIT: "boss-preview:exit",

    ENTERED: "boss-preview:entered",
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


};

// ===== SOCKET ROOM CONSTANTS ===== //
export const SOCKET_ROOMS = {
  BOSS_PREVIEW: (eventBossId) => `boss-preview:${eventBossId}`,
  BATTLE_QUEUE: (eventBattleId) => `battle-queue:${eventBattleId}`,
  BOSS_BATTLE: (eventBossId) => `boss-battle:${eventBossId}`,
};

// ===== ERROR MESSAGES ===== //
export const SOCKET_ERRORS = {

};
