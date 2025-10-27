import cron from "node-cron";
import { Event, EventBoss } from "../../models/index.js";
import { updateEventStatus } from "../utils/helper.js";
import eventManager from "../managers/event.manager.js";

export const startEventStatusScheduler = () => {
  // Runs every minute
  cron.schedule("* * * * *", async () => {
    try {
      const events = await Event.findAll();

      for (const event of events) {
        const currentStatus = updateEventStatus(event);

        if (event.status !== currentStatus) {
          await event.update({ status: currentStatus });
          console.log(
            `[Status Updated] Event: ${event.name} → ${currentStatus}`
          );

          // Refresh event manager cache and handle battle sessions
          if (currentStatus === "completed") {
            console.log(
              `[Event Completed] Refreshing events and ending battle sessions for event: ${event.id}`
            );
            await eventManager.refreshEvents();
          }
        }
      }
    } catch (error) {
      console.error("[Cron Error] Failed to update event statuses:", error);
    }
  });
};

export const startEventBossStatusScheduler = () => {
  // Runs every minute
  cron.schedule("* * * * *", async () => {
    try {
      const eventBosses = await EventBoss.findAll();
      const now = new Date();

      for (const eventBoss of eventBosses) {
        let newStatus = eventBoss.status;
        if (eventBoss.status === "cooldown" && eventBoss.cooldownEndAt <= now) {
          newStatus = "active";
        }

        if (eventBoss.status !== newStatus) {
          await eventBoss.update({ status: newStatus, cooldownEndAt: null });
          console.log(
            `[Status Updated] EventBoss: ${eventBoss.id} → ${newStatus}`
          );
        }
      }
    } catch (error) {
      console.error(
        "[Cron Error] Failed to update event boss statuses:",
        error
      );
    }
  });
};
