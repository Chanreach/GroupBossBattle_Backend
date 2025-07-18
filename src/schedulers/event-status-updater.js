import cron from "node-cron";
import { Event } from "../models/index.js";
import { updateEventStatus } from "../utils/update-event-status.js";

// Runs every minute
cron.schedule("* * * * *", async () => {
  try {
    const events = await Event.findAll();

    for (const event of events) {
      const currentStatus = updateEventStatus(event);

      if (event.status !== currentStatus) {
        await event.update({ status: currentStatus });
        console.log(`[Status Updated] Event: ${event.name} → ${currentStatus}`);
      }
    }

  } catch (error) {
    console.error("[Cron Error] Failed to update event statuses:", error);
  }
});
