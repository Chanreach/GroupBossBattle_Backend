import { EventBoss, Boss, Event } from "../models/index.js";
import UserService from "./user.service.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class EventBossService {
  static async getEventBossById(eventBossId) {
    try {
      const eventBoss = await EventBoss.findByPk(eventBossId, {
        include: [
          {
            model: Boss,
            as: "boss",
          },
          {
            model: Event,
            as: "event",
          },
        ],
      });

      if (!eventBoss) {
        throw new Error("Event boss not found");
      }

      return {
        eventBoss: {
          id: eventBoss.id,
          name: eventBoss.boss.name,
          description: eventBoss.boss.description,
          image: eventBoss.boss.image,
          creatorId: eventBoss.boss.creatorId,
          cooldownDuration: eventBoss.cooldownDuration,
          numberOfTeams: eventBoss.numberOfTeams,
          status: eventBoss.status,
          cooldownEndTime: eventBoss.cooldownEndTime,
          joinCode: eventBoss.joinCode,
        },
        event: {
          id: eventBoss.event.id,
          name: eventBoss.event.name,
          startTime: eventBoss.event.startTime,
          endTime: eventBoss.event.endTime,
          status: eventBoss.event.status,
        },
      };
    } catch (error) {
      console.error("Error fetching event boss by ID:", error);
      throw error;
    }
  }

  static async updateEventBossStatus(eventBossId, status) {
    try {
      const eventBoss = await EventBoss.findByPk(eventBossId);
      if (!eventBoss) {
        throw new Error("Event boss not found");
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
      console.error("Error updating event boss status:", error);
      throw error;
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

  static async getEventById(eventId) {
    try {
      const event = await Event.findByPk(eventId, {
        attributes: { exclude: ["createdAt", "updatedAt"] },
      });
      return event;
    } catch (error) {
      console.error("Error fetching event by ID:", error);
      throw error;
    }
  }
}

export default EventBossService;
