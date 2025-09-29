// import { PlayerSession } from "../models/index.js";

class PlayerSessionService {
  static async createPlayerSession(userId, username, eventId) {
    try {
      const playerSession = await PlayerSession.findOrCreate({
        where: {
          userId,
          username,
          eventId,
        },
      });
      return playerSession[0];
    } catch (error) {
      console.error("Error creating player session:", error);
      throw error;
    }
  }

  static async getPlayerSession(userId, eventId) {
    try {
      const playerSession = await PlayerSession.findOne({
        where: {
          userId,
          eventId,
        },
      });
      return playerSession;
    } catch (error) {
      console.error("Error fetching player session:", error);
      throw error;
    }
  }

  static async deletePlayerSession(userId, eventId) {
    try {
      const playerSession = await PlayerSession.findOne({
        where: {
          userId,
          eventId,
        },
      });
      if (!playerSession) {
        throw new Error("Player session not found.");
      }
      await playerSession.destroy();
    } catch (error) {
      console.error("Error deleting player session:", error);
      throw error;
    }
  }
}

export default PlayerSessionService;
