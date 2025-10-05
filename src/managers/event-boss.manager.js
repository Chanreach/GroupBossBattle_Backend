import EventBossService from "../services/event-boss.service.js";
import { calculateBossHP } from "../utils/game.utils.js";

class EventBossManager {
  async initializeEventBoss(battleSession, eventBossId) {
    if (!battleSession || !eventBossId) {
      console.error("Battle session or event boss ID is missing");
      return null;
    }

    const response = await EventBossService.getEventBossAndEventById(eventBossId);
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
    if (!eventBoss || !numberOfPlayers || numberOfPlayers <= 0) {
      console.error("Event boss or number of players is invalid");
      return null;
    }

    const newMaxHP = calculateBossHP(numberOfPlayers, eventBoss.numberOfTeams);
    if (newMaxHP > eventBoss.maxHP) {
      eventBoss.currentHP += newMaxHP - eventBoss.maxHP;
      eventBoss.maxHP = newMaxHP;
    }
    return eventBoss;
  }

  async updateEventBossStatus(eventBoss, status) {
    if (!eventBoss || !status) {
      console.error("Event boss or status not found");
      return null;
    }

    const updatedEventBoss = await EventBossService.updateEventBossStatus(
      eventBoss.id,
      status
    );
    eventBoss.status = updatedEventBoss?.status ?? eventBoss.status;
    eventBoss.cooldownEndTime = updatedEventBoss?.cooldownEndTime ?? eventBoss.cooldownEndTime;
    return updatedEventBoss;
  }

  isEventBossDefeated(eventBoss) {
    if (!eventBoss) {
      console.error("Event boss not found");
      return null;
    }
    return eventBoss.currentHP <= 0;
  }
}

export default EventBossManager;
