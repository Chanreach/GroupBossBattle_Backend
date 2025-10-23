import {
  startEventStatusScheduler,
  startEventBossStatusScheduler,
} from "./event.scheduler.js";
import { startInactiveGuestCleanupScheduler } from "./guest-cleanup.scheduler.js";

startEventStatusScheduler();
startEventBossStatusScheduler();
startInactiveGuestCleanupScheduler();
