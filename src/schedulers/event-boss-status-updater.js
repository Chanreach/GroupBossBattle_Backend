import cron from "node-cron";
import { EventBoss } from "../../models/index.js";

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
    console.error("[Cron Error] Failed to update event boss statuses:", error);
  }
});
