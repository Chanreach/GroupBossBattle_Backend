import cron from "node-cron";
import { Event } from "../../models/index.js";

const updateEventStatus = (event) => {
  const now = new Date();
  const startAt = new Date(event.startAt);
  const endAt = new Date(event.endAt);

  if (now < startAt) {
    return "upcoming";
  } else if (now >= startAt && now <= endAt) {
    return "ongoing";
  } else {
    return "completed";
  }
};

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
