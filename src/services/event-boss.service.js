import { EventBoss, Boss, Event } from "../../models/index.js";
import { eventBossIncludes } from "../../models/includes.js";
import UserService from "./user.service.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class EventBossService {
  static async getEventBossById(eventBossId) {
    try {
      const eventBoss = await EventBoss.findByPk(eventBossId, {
        include: eventBossIncludes({
          includeBoss: true,
        }),
      });
      if (!eventBoss) {
        console.error("[EventBossService] Event boss not found.");
        return null;
      }

      return eventBoss.getSummary();
    } catch (error) {
      console.error(
        "[EventBossService] Error getting event boss by ID:",
        error
      );
      return null;
    }
  }

  static async getEventBossByIdAndJoinCode(eventBossId, joinCode) {
    try {
      const eventBoss = await EventBoss.findOne({
        where: { id: eventBossId, joinCode },
        include: eventBossIncludes({
          includeEvent: true,
          includeBoss: true,
          includeCategories: true,
          includeQuestions: true,
          includeAnswerChoices: true,
        }),
      });
      if (!eventBoss) {
        console.error("[EventBossService] Event boss not found.");
        return null;
      }

      return eventBoss.getSummary();
    } catch (error) {
      console.error(
        "[EventBossService] Error getting event boss by ID:",
        error
      );
      return null;
    }
  }

  static async getEventBossAndEventById(eventBossId) {
    try {
      const eventBoss = await EventBoss.findByPk(eventBossId, {
        include: eventBossIncludes({
          includeBoss: true,
          includeEvent: true,
        }),
      });
      if (!eventBoss) {
        console.error("[EventBossService] Event boss not found.");
        return null;
      }

      return eventBoss.getSummary();
    } catch (error) {
      console.error(
        "[EventBossService] Error getting event boss and event by ID:",
        error
      );
      return null;
    }
  }

  static async getAllEventBosses(eventId) {
    try {
      const eventBosses = await EventBoss.findAll({
        where: { eventId },
        include: eventBossIncludes({
          includeBoss: true,
        }),
      });
      if (!eventBosses || eventBosses.length === 0) {
        console.error("[EventBossService] No event bosses found.");
        return [];
      }

      const summaries = eventBosses.map((eb) => eb.getSummary());
      return summaries;
    } catch (error) {
      console.error(
        "[EventBossService] Error getting all event bosses:",
        error
      );
      return null;
    }
  }

  static async updateEventBossStatus(eventBossId, status) {
    try {
      const eventBoss = await EventBoss.findByPk(eventBossId);
      if (!eventBoss) {
        console.error("[EventBossService] Event boss not found.");
        return null;
      }

      eventBoss.status = status;
      if (status === GAME_CONSTANTS.BOSS_STATUS.ACTIVE) {
        eventBoss.cooldownEndTime = null;
      } else if (status === GAME_CONSTANTS.BOSS_STATUS.COOLDOWN) {
        eventBoss.cooldownEndTime = new Date(
          Date.now() + eventBoss.cooldownDuration * 1000
        );
      }

      await eventBoss.save();

      return eventBoss;
    } catch (error) {
      console.error(
        "[EventBossService] Error updating event boss status:",
        error
      );
      return null;
    }
  }

  static async isAllowedToSpectate(eventBossId, spectatorId) {
    try {
      const eventBoss = await EventBoss.findByPk(eventBossId);
      if (!eventBoss) {
        throw new Error("Event boss not found");
      }

      const spectator = await UserService.getUserById(spectatorId);
      if (!spectator) {
        throw new Error("Spectator not found");
      }

      return eventBoss.creatorId === spectator.id || spectator.role === "admin";
    } catch (error) {
      console.error("Error checking spectator permissions:", error);
      throw error;
    }
  }
}

export default EventBossService;
