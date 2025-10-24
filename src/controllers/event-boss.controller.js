import { EventBoss, Event, Boss } from "../../models/index.js";
import { eventBossIncludes, eventIncludes } from "../../models/includes.js";
import ApiError from "../utils/api-error.util.js";
import { generateJoinCode } from "../utils/code.util.js";

const getAllEventBosses = async (req, res, next) => {
  try {
    const eventBosses = await EventBoss.findAll({
      include: eventIncludes({
        includeEvent: true,
        includeBoss: true,
        includeCreator: true,
      }),
    });

    const summaries = eventBosses.map((eb) => eb.getSummary());

    res.status(200).json(summaries);
  } catch (error) {
    next(error);
  }
};

const getEventBossById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const eventBoss = await EventBoss.findByPk(id, {
      include: eventBossIncludes({
        includeEvent: true,
        includeBoss: true,
        includeCreator: true,
      }),
    });
    if (!eventBoss) {
      throw new ApiError(404, "Event boss not found.");
    }

    res.status(200).json(eventBoss.getSummary());
  } catch (error) {
    next(error);
  }
};

const getEventBossByIdAndJoinCode = async (req, res, next) => {
  const { id, joinCode } = req.params;
  try {
    const eventBoss = await EventBoss.findOne({
      where: { id, joinCode },
      include: eventBossIncludes({
        includeEvent: true,
        includeBoss: true,
        includeCreator: true,
        includeCategories: true,
        includeQuestions: true,
        includeAnswerChoices: true,
      }),
    });
    if (!eventBoss) {
      throw new ApiError(404, "Event boss not found.");
    }

    res.status(200).json(eventBoss.getSummary());
  } catch (error) {
    next(error);
  }
};

export const createEventBoss = async (req, res, next) => {
  const { eventId, bossId, cooldownDuration, numberOfTeams } = req.body;
  const user = req.user;

  try {
    const event = await Event.findByPk(eventId);
    if (!event) {
      throw new ApiError(404, "Event not found.");
    }
    if (event.status === "completed")
      throw new ApiError(400, "Cannot add boss to a completed event.");

    const boss = await Boss.findByPk(bossId);
    if (!boss) {
      throw new ApiError(404, "Boss not found.");
    }
    const isAuthorized =
      boss.creatorId === user.id ||
      user.role === "admin" ||
      user.role === "superadmin";
    if (!isAuthorized) {
      throw new ApiError(
        403,
        "Forbidden: You are not allowed to perform this action."
      );
    }

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
      bossId,
      joinCode,
      cooldownDuration,
      numberOfTeams,
    });

    res.status(201).json({
      message: "Event boss created successfully!",
      eventBoss: newEventBoss.getSummary(),
    });
  } catch (error) {
    next(error);
  }
};

const updateEventBoss = async (req, res, next) => {
  const { id } = req.params;
  const { cooldownDuration, numberOfTeams } = req.body;

  try {
    const eventBoss = await EventBoss.findByPk(id);
    if (!eventBoss) {
      throw new ApiError(404, "Event boss not found.");
    }

    const updatedFields = {};
    if (cooldownDuration) updatedFields.cooldownDuration = cooldownDuration;
    if (numberOfTeams) updatedFields.numberOfTeams = numberOfTeams;

    if (Object.keys(updatedFields).length === 0) {
      return res.status(200).json({
        message: "No changes detected. Event boss remains unchanged.",
        eventBoss: eventBoss.getSummary(),
      });
    }

    await eventBoss.update(updatedFields);

    res.status(200).json({
      message: "Event boss updated successfully!",
      eventBoss: eventBoss.getSummary(),
    });
  } catch (error) {
    next(error);
  }
};

const deleteEventBoss = async (req, res, next) => {
  const { id } = req.params;

  try {
    const eventBoss = await EventBoss.findByPk(id);
    if (!eventBoss) {
      throw new ApiError(404, "Event boss not found.");
    }

    await eventBoss.destroy();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export default {
  getAllEventBosses,
  getEventBossById,
  getEventBossByIdAndJoinCode,
  createEventBoss,
  updateEventBoss,
  deleteEventBoss,
};
