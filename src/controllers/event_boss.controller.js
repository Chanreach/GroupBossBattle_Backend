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
    const boss = await EventBoss.findByPk(id, {
      include: ['boss', 'event']
    });
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

const getEventBossByJoinCode = async (req, res) => {
  const { joinCode } = req.params;
  try {
    const eventBoss = await EventBoss.findOne({
      where: { joinCode },
      include: ['boss', 'event'] // Include related Boss and Event data
    });
    
    if (!eventBoss) {
      return res.status(404).json({ 
        success: false,
        message: "Boss not found with this join code" 
      });
    }
    
    res.status(200).json({
      success: true,
      data: {
        id: eventBoss.id,
        event_id: eventBoss.eventId,
        boss_id: eventBoss.bossId,
        joinCode: eventBoss.joinCode,
        boss: eventBoss.boss,
        event: eventBoss.event
      }
    });
  } catch (error) {
    console.error("Error fetching event boss by join code:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
}

const updateEventBossStatus = async (req, res) => {
  const { id } = req.params;
  const { status, cooldownEndTime } = req.body;

  try {
    const eventBoss = await EventBoss.findByPk(id);
    if (!eventBoss) {
      return res.status(404).json({ message: "Event boss not found" });
    }

    // Update the status and cooldown end time
    await eventBoss.update({
      status,
      cooldownEndTime: cooldownEndTime || null
    });

    res.status(200).json({
      success: true,
      message: "Boss status updated successfully",
      eventBoss: {
        id: eventBoss.id,
        status: eventBoss.status,
        cooldownEndTime: eventBoss.cooldownEndTime
      }
    });
  } catch (error) {
    console.error("Error updating event boss status:", error);
    res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
}

export default {
  getAllEventBosses,
  getEventBossById,
  getEventBossByJoinCode,
  createEventBoss,
  updateEventBoss,
  updateEventBossStatus,
  deleteEventBoss
};
