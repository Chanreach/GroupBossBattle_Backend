import express from "express";
import eventController from "../controllers/event.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import {
  checkBossesOwnership,
  checkEventBossesOwnership,
  getEventFilter,
} from "../middleware/resource.middleware.js";

const router = express.Router();

router.get("/public", eventController.getAllPublicEvents);
router.get("/public/:id", eventController.getPublicEventById);

router.use(authenticateToken, authorizeRoles("superadmin", "admin", "host"));
router.get("/", getEventFilter, eventController.getAllEvents);
router.get("/:id", eventController.getEventById);

router.get("/:id/available-bosses", eventController.getAvailableBossesForEvent);
router.post(
  "/:id/bosses",
  checkBossesOwnership,
  eventController.assignBossesToEvent
);
router.delete(
  "/:id/bosses",
  checkEventBossesOwnership,
  eventController.unassignBossFromEvent
);

router.use(authorizeRoles("superadmin", "admin"));
router.post("/", eventController.createEvent);
router.put("/:id", eventController.updateEvent);
router.delete("/:id", eventController.deleteEvent);

export default router;
