import express from "express";
import joinController from "../controllers/join.controller.js";

const router = express.Router();

router.post("/boss-fight", joinController.joinBossFight);

export default router;
