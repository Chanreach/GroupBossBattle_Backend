import { EventBoss, Boss, Event } from "../models/index.js";
import UserService from "./user.service.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";
import { getImageUrl } from "../utils/image.utils.js";

class EventBossService {
  static async getEventBossById(eventBossId) {
    try {
      const eventBoss = await EventBoss.findByPk(eventBossId, {
        include: [
          {
            model: Boss,
            as: "boss",
          },
        ],
      });

      if (!eventBoss) {
        console.error("Event boss not found");
        return null;
      }

      return {
        id: eventBoss.id,
        name: eventBoss.boss.name,
        description: eventBoss.boss.description,
        image: eventBoss.boss.image ? getImageUrl(eventBoss.boss.image) : null,
        creatorId: eventBoss.boss.creatorId,
        status: eventBoss.status,
        numberOfTeams: eventBoss.numberOfTeams,
        cooldownDuration: eventBoss.cooldownDuration,
        cooldownEndTime: eventBoss.cooldownEndTime,
        joinCode: eventBoss.joinCode,
      };
    } catch (error) {
      console.error("Error getting event boss by ID:", error);
      return null;
    }
  }

  static async getEventBossAndEventById(eventBossId) {
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
        console.error("Event boss not found");
        return null;
      }

      return {
        eventBoss: {
          id: eventBoss.id,
          name: eventBoss.boss.name,
          description: eventBoss.boss.description,
          image: eventBoss.boss.image ? getImageUrl(eventBoss.boss.image) : null,
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
      console.error("Error getting event boss and event by ID:", error);
      return null;
    }
  }

  static async getAllEventBosses(eventId) {
    try {
      const eventBosses = await EventBoss.findAll({
        where: { eventId },
        include: [
          {
            model: Boss,
            as: "boss",
          },
        ],
      });
      
      if (!eventBosses || eventBosses.length === 0) {
        console.error("No event bosses found");
        return [];
      }

      return eventBosses.map((eventBoss) => ({
        id: eventBoss.id,
        name: eventBoss.boss.name,
        description: eventBoss.boss.description,
        image: eventBoss.boss.image ? getImageUrl(eventBoss.boss.image) : null,
        creatorId: eventBoss.boss.creatorId,
        status: eventBoss.status,
        numberOfTeams: eventBoss.numberOfTeams,
        cooldownDuration: eventBoss.cooldownDuration,
        cooldownEndTime: eventBoss.cooldownEndTime,
        joinCode: eventBoss.joinCode,
      }));
    } catch (error) {
      console.error("Error getting all event bosses:", error);
      return null;
    }
  }

  static async updateEventBossStatus(eventBossId, status) {
    try {
      const eventBoss = await EventBoss.findByPk(eventBossId);
      if (!eventBoss) {
        console.error("Event boss not found");
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
      console.error("Error updating event boss status:", error);
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
