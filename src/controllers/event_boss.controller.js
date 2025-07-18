import { EventBoss } from "../models/index.js";
import { generateUniqueJoinCode } from "../utils/generateJoinCode.js";

const getAllEventBosses = async (req, res) => {
  try {
    const bosses = await EventBoss.findAll();
    res.status(200).json(bosses);
  } catch (error) {
    console.error("Error fetching event bosses:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const getEventBossById = async (req, res) => {
  const { id } = req.params;
  try {
    const boss = await EventBoss.findByPk(id);
    if (!boss) {
      return res.status(404).json({ message: "Event boss not found" });
    }
    res.status(200).json(boss);
  } catch (error) {
    console.error("Error fetching event boss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const createEventBoss = async (req, res) => {
  const { eventId, bossId } = req.body;

  try {
    const joinCode = await generateUniqueJoinCode();

    const newEventBoss = await EventBoss.create({
      eventId,
      bossId,
      joinCode,
    });

    res.status(201).json(newEventBoss);
  } catch (error) {
    console.error("Error creating event boss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const updateEventBoss = async (req, res) => {
  const { id } = req.params;
  const { eventId, bossId, userId } = req.body;

  try {
    const eventBossEntry = await EventBoss.findByPk(id);
    if (!eventBossEntry) {
      return res.status(404).json({ message: "Event boss not found" });
    }

    eventBossEntry.eventId = eventId || eventBossEntry.eventId;
    eventBossEntry.bossId = bossId || eventBossEntry.bossId;
    eventBossEntry.userId = userId || eventBossEntry.userId;

    await eventBossEntry.save();
    res.status(200).json(eventBossEntry);
  } catch (error) {
    console.error("Error updating event boss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const deleteEventBoss = async (req, res) => {
  const { id } = req.params;

  try {
    const eventBossEntry = await EventBoss.findByPk(id);
    if (!eventBossEntry) {
      return res.status(404).json({ message: "Event boss not found" });
    }

    await eventBossEntry.destroy();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting event boss:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export default {
  getAllEventBosses,
  getEventBossById,
  createEventBoss,
  updateEventBoss,
  deleteEventBoss
};
