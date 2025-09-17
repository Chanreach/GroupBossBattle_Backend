import EventBossService from "../services/event-boss.service.js";
import { calculateBossHP } from "../utils/game.utils.js";

class EventBossManager {
  async initializeEventBoss(battleSession, eventBossId) {
    if (!eventBossId) {
      throw new Error("Event boss ID is required");
    }
    const response = await EventBossService.getEventBossById(eventBossId);
    if (!response) {
      return null;
    }
    battleSession.eventBoss = {
      ...response.eventBoss,
      maxHP: 0,
      currentHP: 0,
    };
    battleSession.event = response.event;
    return response;
  }

  updateEventBossHP(eventBoss, numberOfPlayers) {
    if (!eventBoss) {
      return;
    }

    const newMaxHP = calculateBossHP(numberOfPlayers, eventBoss.numberOfTeams);
    if (newMaxHP > eventBoss.maxHP) {
      eventBoss.currentHP += newMaxHP - eventBoss.maxHP;
      eventBoss.maxHP = newMaxHP;
    }
  }

  async updateEventBossStatus(eventBoss, status) {
    if (!eventBoss || !status) {
      throw new Error("Event boss or status not found");
    }
    const updatedEventBoss = await EventBossService.updateEventBossStatus(
      eventBoss.id,
      status
    );
    eventBoss.status = updatedEventBoss.status;
    eventBoss.cooldownEndTime = updatedEventBoss.cooldownEndTime;
    return updatedEventBoss;
  }

  isEventBossDefeated(eventBoss) {
    if (!eventBoss) {
      throw new Error("Event boss not found");
    }
    return eventBoss.currentHP <= 0;
  }
}

export default EventBossManager;
