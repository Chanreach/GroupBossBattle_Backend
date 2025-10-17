import express from "express";
import eventController from "../controllers2/event.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import {
  checkEventOwnership,
  getEventFilter,
} from "../middleware/resource.middleware.js";

const router = express.Router();

router.get("/public", eventController.getAllPublicEvents);
router.get("/public/:id", eventController.getPublicEventById);

router.use(authenticateToken, authorizeRoles("host", "admin"));

router.get("/", getEventFilter, eventController.getAllEvents);
router.get("/:id", eventController.getEventById);

// // Routes only for admins (event creation/editing)
// router.post("/", authorizeRoles("admin"), eventController.createEvent);
// router.put(
//   "/:id",
//   authorizeRoles("admin"),
//   checkEventOwnership,
//   eventController.updateEvent
// );
// router.delete(
//   "/:id",
//   authorizeRoles("admin"),
//   checkEventOwnership,
//   eventController.deleteEvent
// );

// // Boss assignment routes (hosts can assign their own bosses, admins can assign any)
// router.post("/:id/bosses", eventController.assignBossesToEvent);
// router.delete("/:id/bosses/:bossId", eventController.unassignBossFromEvent);

// // QR code generation route
// router.get("/:id/bosses/:bossId/qr", eventController.generateBossQRCode);

export default router;
