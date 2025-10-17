import { Event } from "../models/index.js";

class EventService {
  static async getAllEvents() {
    try {
      const events = await Event.findAll({
        attributes: { exclude: ["createdAt", "updatedAt"] },
      });
      return events;
    } catch (error) {
      console.error("Error getting events:", error);
      return null;
    }
  }
}

export default EventService;
