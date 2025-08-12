import { Boss, EventBoss } from "../models/index.js";

class BossService {
  static async getBossByEventBossId(eventBossId) {
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
        throw new Error("Event boss not found");
      }

      const eventBossData = {
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
        eventId: eventBoss.eventId,
      };
      return eventBossData;
    } catch (error) {
      console.error("Error fetching boss by event boss ID:", error);
      throw error;
    }
  }

  static async getEventBossByIdAndJoinCode(eventBossId, joinCode) {
    const eventBoss = await EventBoss.findOne({
      where: {
        id: eventBossId,
        joinCode: joinCode,
      },
      include: [
        {
          model: Boss,
          as: "boss",
        },
      ],
    });

    if (!eventBoss) return null;

    return {
      name: eventBoss.boss.name,
      description: eventBoss.boss.description,
      image: eventBoss.boss.image,
      status: eventBoss.status,
      cooldownDuration: eventBoss.cooldownDuration,
      cooldownEndTime: eventBoss.cooldownEndTime,
    };
  }
}

export default BossService;
