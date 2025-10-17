import { Event, User } from "../../models/index.js";
import { Op } from "sequelize";
import ApiError from "../utils/api-error.util.js";

const updateEventStatus = (event) => {
  const now = new Date();
  const startAt = new Date(event.startAt);
  const endAt = new Date(event.endAt);

  if (now < startAt) return "upcoming";
  else if (now >= startAt && now < endAt) return "ongoing";
  else return "completed";
};

const getAllEvents = async (req, res, next) => {
  const filter = req.eventFilter || {};

  try {
    const events = await Event.findAll({
      where: filter,
      include: [{ model: User, as: "creator" }],
      order: [["createdAt", "DESC"]],
    });

    const summaries = events.map((event) => {
      event.status = updateEventStatus(event);
      return event.getSummary();
    });
    res.status(200).json(summaries);
  } catch (error) {
    next(error);
  }
};

const getEventById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const event = await Event.findByPk(id);
  } catch(error) {
    next(error);
  }
};

const getAllPublicEvents = async (req, res, next) => {
  try {
    const events = await Event.findAll({
      where: filter,
      order: [["createdAt", "DESC"]],
    });

    const summaries = events.map((event) => {
      event.status = updateEventStatus(event);
      return event.getSummary();
    });
    res.status(200).json(summaries);
  } catch (error) {
    next(error);
  }
}

const getPublicEventById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const event = await Event.findByPk(id);
  } catch(error) {
    next(error);
  }
}

export default { getAllEvents, getEventById, getAllPublicEvents, getPublicEventById };
