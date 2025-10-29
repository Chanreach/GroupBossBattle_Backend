import { Event } from "../../models/index.js";

class EventService {
  static async getAllEvents() {
    try {
      const events = await Event.findAll();
      const summaries = events.map((event) => event.getSummary());
      return summaries;
    } catch (error) {
      console.error("[EventService] Error getting events:", error);
      return null;
    }
  }

  static async getEventById(eventId) {
    try {
      const event = await Event.findByPk(eventId);
      if (!event) {
        console.error("[EventService] Event not found.");
        return null;
      }

      return event.getSummary();
    } catch (error) {
      console.error("[EventService] Error getting event by ID:", error);
      return null;
    }
  }
}

export default EventService;
