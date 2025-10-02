import express from "express";
import { activityTracker } from "../middleware/activityTracker.js";

const router = express.Router();

router.use(activityTracker);
router.get("/", (req, res) => {
  res.status(200).json({ message: "Heartbeat received" });
});

export default router;
