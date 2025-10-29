import EventService from "../services/event.service.js";
import EventBossService from "../services/event-boss.service.js";
import battleSessionManager from "./battle-session.manager.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class EventManager {
  constructor() {
    this.events = new Map();
    this.io = null;
  }

  setSocketIO(io) {
    this.io = io;
  }

  async initializeEvents() {
    const events = await EventService.getAllEvents();
    events.forEach((event) => {
      this.events.set(event.id, event);
    });
  }

  async refreshEvents() {
    const oldEvents = Array.from(this.events.values());
    this.events.clear();

    const updatedEvents = await EventService.getAllEvents();
    updatedEvents.forEach((event) => {
      this.events.set(event.id, event);

      const oldEvent = oldEvents.find((e) => e.id === event.id);
      if (
        oldEvent &&
        oldEvent.status !== event.status &&
        event.status === "completed"
      ) {
        console.log(
          `[EventManager] Event ${event.id} status changed to completed. Ending battle sessions...`
        );
        battleSessionManager.endBattleSessionsGracefully(this.io, event.id);
      }
    });
  }

  getEventById(eventId) {
    return this.events.get(eventId) || null;
  }

  async getEventByEventBossId(eventBossId) {
    const response = await EventBossService.getEventBossAndEventById(
      eventBossId
    );
    if (!response) {
      console.error(
        "[EventManager] Failed to retrieve event for event boss ID:",
        eventBossId
      );
      return null;
    }

    return response.event || null;
  }

  getEventStatus(eventId) {
    const event = this.getEventById(eventId);
    if (!event) {
      console.error("[EventManager] Event not found for ID:", eventId);
      return null;
    }

    const now = Date.now();
    const startAt = new Date(event.startAt);
    const endAt = new Date(event.endAt);

    if (now < startAt) return GAME_CONSTANTS.EVENT_STATUS.UPCOMING;
    if (now >= startAt && now < endAt)
      return GAME_CONSTANTS.EVENT_STATUS.ONGOING;
    return GAME_CONSTANTS.EVENT_STATUS.COMPLETED;
  }
}

const eventManager = new EventManager();
export default eventManager;
