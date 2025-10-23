import cron from "node-cron";
import { User } from "../../models/index.js";
import { Op } from "sequelize";

export const startInactiveGuestCleanupScheduler = () => {
  // Runs every hour
  cron.schedule("0 * * * *", async () => {
    try {
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const inactiveGuests = await User.findAll({
        where: {
          isGuest: true,
          lastActiveAt: { [Op.lt]: cutoffDate },
        },
      });
      const inactiveGuestIds = inactiveGuests.map((guest) => guest.id);

      if (inactiveGuestIds.length > 0) {
        await User.destroy({
          where: { id: { [Op.in]: inactiveGuestIds } },
        });
        console.log(
          `Cleaned up ${inactiveGuestIds.length} inactive guest users.`
        );
      }
    } catch (error) {
      console.error(
        "[Cron Error] Failed to clean up inactive guest users:",
        error
      );
    }
  });
};
