import { Event, Boss, EventBoss } from "../../models/index.js";
import { eventIncludes, eventBossIncludes } from "../../models/includes.js";
import { Op } from "sequelize";
import eventManager from "../managers/event.manager.js";
import ApiError from "../utils/api-error.util.js";
import { generateJoinCode } from "../utils/code.util.js";
import {
  updateEventStatus,
  normalizeName,
  normalizeText,
} from "../utils/helper.js";

const sortEvents = (events) => {
  const statusOrder = {
    ongoing: 1,
    upcoming: 2,
    completed: 3,
  };

  return events.sort((a, b) => {
    const statusA = statusOrder[a.status] || 999;
    const statusB = statusOrder[b.status] || 999;

    if (statusA !== statusB) {
      return statusA - statusB;
    }

    if (a.status === "completed" && b.status === "completed") {
      return new Date(b.endAt) - new Date(a.endAt);
    }
    return new Date(a.startAt) - new Date(b.startAt);
  });
};

const getAllEvents = async (req, res, next) => {
  const filter = req.eventFilter || {};

  try {
    const events = await Event.findAll({
      where: filter,
      include: eventIncludes({
        includeCreator: true,
        includeEventBosses: true,
      }),
    });

    const summaries = events.map((event) => {
      event.status = updateEventStatus(event);
      return event.getSummary();
    });

    res.status(200).json(sortEvents(summaries));
  } catch (error) {
    next(error);
  }
};

const getEventById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const event = await Event.findByPk(id, {
      include: eventIncludes({
        includeCreator: true,
        includeEventBosses: true,
      }),
    });

    event.eventBosses = await EventBoss.findAll({
      where: { eventId: event.id },
      include: eventBossIncludes({
        includeBoss: true,
        includeCreator: true,
        includeCategories: true,
      }),
      order: [["createdAt", "ASC"]],
    });
    if (!event) {
      throw new ApiError(404, "Event not found.");
    }

    event.status = updateEventStatus(event);

    res.status(200).json(event.getSummary());
  } catch (error) {
    next(error);
  }
};

const createEvent = async (req, res, next) => {
  const { name, description, startAt, endAt } = req.body;
  const requesterId = req.user.id;

  try {
    const newEvent = await Event.create({
      name: normalizeName(name),
      description: normalizeText(description),
      startAt: startAt,
      endAt: endAt,
      creatorId: requesterId,
    });

    res.status(201).json({
      message: "Event created successfully!",
      event: newEvent.getSummary(),
    });
  } catch (error) {
    next(error);
  }
};

const updateEvent = async (req, res, next) => {
  const { id } = req.params;
  const { name, description, startAt, endAt } = req.body;

  try {
    const event = await Event.findByPk(id);
    if (!event) {
      throw new ApiError(404, "Event not found.");
    }

    const updatedFields = {};
    if (name) updatedFields.name = normalizeName(name);
    if (description) updatedFields.description = normalizeText(description);
    if (startAt) updatedFields.startAt = startAt;
    if (endAt) updatedFields.endAt = endAt;

    if (Object.keys(updatedFields).length > 0) {
      await event.update(updatedFields);
    }

    await eventManager.refreshEvents();

    res.status(200).json({
      message: "Event updated successfully!",
      event: event.getSummary(),
    });
  } catch (error) {
    next(error);
  }
};

const deleteEvent = async (req, res, next) => {
  const { id } = req.params;

  try {
    const event = await Event.findByPk(id, {
      include: eventIncludes({ includeEventBosses: true }),
    });
    if (!event) {
      throw new ApiError(404, "Event not found.");
    }

    if (event.eventBosses && event.eventBosses.length > 0) {
      for (const eventBoss of event.eventBosses) {
        if (eventBoss.status === "in-battle") {
          throw new ApiError(
            400,
            "Cannot delete an event with event bosses that are currently in battle."
          );
        }
        await eventBoss.destroy();
      }
    }

    await event.destroy();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const getAvailableBossesForEvent = async (req, res, next) => {
  const { id: eventId } = req.params;
  const requesterId = req.user.id;

  try {
    const event = await Event.findByPk(eventId);
    if (!event) {
      throw new ApiError(404, "Event not found.");
    }

    const bosses = await Boss.scope([
      { method: ["byCreator", requesterId] },
    ]).findAll();
    const bossIds = bosses.map((boss) => boss.id);

    const eventBosses = await EventBoss.findAll({
      where: { eventId, bossId: { [Op.in]: bossIds } },
      order: [["createdAt", "ASC"]],
    });

    const assignedBossIds = eventBosses.map((eb) => eb.bossId);
    const availableBosses = bosses
      .filter((boss) => !assignedBossIds.includes(boss.id))
      .map((boss) => boss.getSummary());

    res.status(200).json(availableBosses);
  } catch (error) {
    next(error);
  }
};

const assignBossesToEvent = async (req, res, next) => {
  const { id: eventId } = req.params;
  const { bossIds } = req.body;

  try {
    const event = await Event.findByPk(eventId);
    if (!event) {
      throw new ApiError(404, "Event not found.");
    }
    if (event.status === "completed") {
      throw new ApiError(400, "Cannot assign boss(es) to a completed event.");
    }

    if (!Array.isArray(bossIds) || bossIds.length === 0) {
      throw new ApiError(400, "Invalid boss IDs.");
    }

    const uniqueBossIds = [...new Set(bossIds)];
    const bosses = await Boss.findAll({
      where: { id: { [Op.in]: uniqueBossIds } },
    });
    if (bosses.length !== uniqueBossIds.length) {
      throw new ApiError(400, "One or more bosses not found.");
    }

    const existingEventBosses = await EventBoss.findAll({
      where: { eventId, bossId: { [Op.in]: uniqueBossIds } },
    });
    const existingBossIds = existingEventBosses.map((eb) => eb.bossId);
    const newBossIds = uniqueBossIds.filter(
      (bossId) => !existingBossIds.includes(bossId)
    );
    if (newBossIds.length === 0) {
      throw new ApiError(
        400,
        "All specified bosses are already assigned to the event."
      );
    }

    const results = { success: [], failed: [] };
    for (const boss of bosses) {
      if (newBossIds.includes(boss.id)) {
        try {
          let joinCode;
          let isUnique = false;
          while (!isUnique) {
            joinCode = generateJoinCode();
            const existing = await EventBoss.findOne({
              where: { eventId, joinCode },
            });
            if (!existing) isUnique = true;
          }

          const newEventBoss = await EventBoss.create({
            eventId,
            bossId: boss.id,
            cooldownDuration: boss.cooldownDuration,
            numberOfTeams: boss.numberOfTeams,
            joinCode,
          });

          results.success.push({
            bossId: boss.id,
            bossName: boss.name,
            eventBossId: newEventBoss.id,
          });
        } catch (error) {
          console.error("Error assigning boss to event:", error);
          results.failed.push({
            bossId: boss.id,
            bossName: boss.name,
            reason: error.message,
          });
        }
      }
    }

    res
      .status(200)
      .json({ message: "Bosses assigned to event successfully!", results });
  } catch (error) {
    next(error);
  }
};

const unassignBossFromEvent = async (req, res, next) => {
  const { id: eventId } = req.params;
  const { eventBossIds } = req.body;

  try {
    const event = await Event.findByPk(eventId);
    if (!event) {
      throw new ApiError(404, "Event not found.");
    }

    if (!Array.isArray(eventBossIds) || eventBossIds.length === 0) {
      throw new ApiError(400, "Invalid event boss IDs.");
    }

    const uniqueEventBossIds = [...new Set(eventBossIds)];
    const eventBosses = await EventBoss.findAll({
      where: { id: { [Op.in]: uniqueEventBossIds }, eventId },
      include: eventBossIncludes({ includeBoss: true }),
      order: [["createdAt", "ASC"]],
    });
    if (eventBosses.length === 0) {
      throw new ApiError(400, "No valid event bosses found to unassign.");
    }

    const results = { success: [], failed: [] };
    if (event.status === "ongoing") {
      throw new ApiError(
        400,
        "Cannot unassign event bosses from an ongoing event."
      );
    }

    for (const eventBoss of eventBosses) {
      if (eventBoss.status === "in-battle") {
        results.failed.push({
          eventBossId: eventBoss.id,
          eventBossName: eventBoss.boss.name,
          reason: "Cannot unassign an event boss that is currently in battle.",
        });
        continue;
      }

      try {
        await eventBoss.destroy();
        results.success.push({ eventBossId: eventBoss.id });
      } catch (error) {
        console.error("Error unassigning event boss:", error);
        results.failed.push({
          eventBossId: eventBoss.id,
          eventBossName: eventBoss.boss.name,
          reason: error.message,
        });
      }
    }

    const eventBossesAfterUnassign = await EventBoss.findAll({
      where: { eventId },
      include: eventBossIncludes({
        includeBoss: true,
        includeCreator: true,
        includeCategories: true,
      }),
    });
    const summaries = eventBossesAfterUnassign.map((eb) => eb.getSummary());

    res.status(200).json({
      message: "Event bosses unassigned successfully!",
      eventBosses: summaries,
      results,
    });
  } catch (error) {
    next(error);
  }
};

const getAllPublicEvents = async (req, res, next) => {
  try {
    const events = await Event.findAll();
    const summaries = events.map((event) => {
      event.status = updateEventStatus(event);
      return event.getSummary();
    });

    res.status(200).json(summaries);
  } catch (error) {
    next(error);
  }
};

const getPublicEventById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const event = await Event.findByPk(id, {
      include: eventIncludes({
        includeCreator: true,
        includeEventBosses: true,
        includeBoss: true,
        includeCategories: true,
      }),
    });
    if (!event) {
      throw new ApiError(404, "Event not found.");
    }

    event.status = updateEventStatus(event);

    res.status(200).json(event.getSummary());
  } catch (error) {
    next(error);
  }
};

export default {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getAvailableBossesForEvent,
  assignBossesToEvent,
  unassignBossFromEvent,
  getAllPublicEvents,
  getPublicEventById,
};
