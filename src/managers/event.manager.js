import EventService from "../services/event.service.js";

class EventManager {
  constructor() {
    this.events = new Map();
  }

  async initializeEvents() {
    const events = await EventService.getAllEvents();
    events.forEach((event) => {
      this.events.set(event.id, event);
    });
  }

  async refreshEvents() {
    this.events.clear();
    await this.initializeEvents();
  }

  getEventById(eventId) {
    return this.events.get(eventId) || null;
  }
}

const eventManager = new EventManager();
await eventManager.initializeEvents();

export default eventManager;
