import { Event, User, Boss, EventBoss, Category } from "../models/index.js";
import { Op } from "sequelize";
import { generateUniqueJoinCode } from "../utils/generateJoinCode.js";
import { generateBossJoinQRCode } from "../utils/qrCodeGenerator.js";
import { getImageUrl } from "../utils/image.utils.js";

// Helper function to update event status based on current time
const updateEventStatus = (event) => {
  const now = new Date();
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  if (now < startTime) {
    return "upcoming";
  } else if (now >= startTime && now <= endTime) {
    return "ongoing";
  } else {
    return "completed";
  }
};

const getAllEvents = async (req, res) => {
  try {
    // Get user filter based on role
    const filter = req.eventFilter || {};

    const events = await Event.findAll({
      where: filter,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
        {
          model: EventBoss,
          as: "eventBosses",
          include: [
            {
              model: Boss,
              as: "boss",
              attributes: [
                "id",
                "name",
                "image",
                "description",
                "cooldownDuration",
                "numberOfTeams",
                "creatorId",
              ],
              include: [
                {
                  model: User,
                  as: "creator",
                  attributes: ["id", "username"],
                },
                {
                  model: Category,
                  as: "Categories",
                  through: { attributes: [] },
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Update status and format datetime for each event
    let eventsWithStatus = await Promise.all(
      events.map(async (event) => {
        const currentStatus = updateEventStatus(event);

        // Update status in database if it has changed
        if (event.status !== currentStatus) {
          await event.update({ status: currentStatus });
        }

        return {
          ...event.toJSON(),
          status: currentStatus,
        };
      })
    );

    if (eventsWithStatus) {
      eventsWithStatus = eventsWithStatus.map((event) => ({
        ...event,
        eventBosses: event.eventBosses.map((eb) => ({
          ...eb,
          boss: eb.boss
            ? {
                ...eb.boss,
                image: eb.boss.image ? getImageUrl(eb.boss.image) : null,
              }
            : null,
        })),
      }));
    }

    res.status(200).json(eventsWithStatus);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getEventById = async (req, res) => {
  const { id } = req.params;
  try {
    const event = await Event.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "email"],
        },
        {
          model: EventBoss,
          as: "eventBosses",
          include: [
            {
              model: Boss,
              as: "boss",
              attributes: [
                "id",
                "name",
                "image",
                "description",
                "cooldownDuration",
                "numberOfTeams",
                "creatorId",
              ],
              include: [
                {
                  model: User,
                  as: "creator",
                  attributes: ["id", "username"],
                },
                {
                  model: Category,
                  as: "Categories",
                  through: { attributes: [] },
                },
              ],
            },
          ],
        },
      ],
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Update status based on current time
    const currentStatus = updateEventStatus(event);
    if (event.status !== currentStatus) {
      await event.update({ status: currentStatus });
    }

    const eventWithStatus = {
      ...event.toJSON(),
      status: currentStatus,
    };

    if (eventWithStatus.eventBosses) {
      eventWithStatus.eventBosses = eventWithStatus.eventBosses.map((eb) => ({
        ...eb,
        boss: eb.boss
          ? {
              ...eb.boss,
              image: eb.boss.image ? getImageUrl(eb.boss.image) : null,
            }
          : null,
      }));
    }

    res.status(200).json(eventWithStatus);
  } catch (error) {
    console.error("Error fetching event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const createEvent = async (req, res) => {
  const { name, description, startTime, endTime } = req.body;

  if (!name || !startTime || !endTime) {
    return res
      .status(400)
      .json({ message: "Name, start time, and end time are required" });
  }

  if (new Date(startTime) >= new Date(endTime)) {
    return res
      .status(400)
      .json({ message: "End time must be after start time" });
  }

  // Store as received from user - no validation or conversion
  try {
    // Check if event with the same name already exists for this user
    const existingEvent = await Event.findOne({
      where: {
        name,
        creatorId: req.user.id,
      },
    });

    if (existingEvent) {
      return res
        .status(409)
        .json({ message: "Event with this name already exists" });
    }

    // Store the times as received from user (no conversion)
    const eventData = {
      name,
      description,
      startTime: startTime,
      endTime: endTime,
      creatorId: req.user.id,
      status: updateEventStatus({ startTime: startTime, endTime: endTime }),
    };

    const newEvent = await Event.create(eventData);

    res.status(201).json(newEvent.toJSON());
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateEvent = async (req, res) => {
  const { id } = req.params;
  const { name, description, startTime, endTime } = req.body;

  try {
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if the event name already exists for this user
    if (name && name !== event.name) {
      const existingEvent = await Event.findOne({
        where: {
          name,
          creatorId: req.user.id,
          id: { [Op.ne]: id }, // Exclude current event
        },
      });

      if (existingEvent) {
        return res
          .status(409)
          .json({ message: "Event with this name already exists" });
      }
    }

    if (endTime) {
      event.endTime = endTime;
    }

    // Update event fields
    event.name = name || event.name;
    event.description =
      description !== undefined ? description : event.description;
    event.status = updateEventStatus({
      startTime: event.startTime,
      endTime: event.endTime,
    });

    await event.save();

    res.status(200).json(event.toJSON());
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteEvent = async (req, res) => {
  const { id } = req.params;
  try {
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    await event.destroy();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Boss assignment functions
const assignBossesToEvent = async (req, res) => {
  const { id: eventId } = req.params;
  const { bossIds } = req.body;

  if (!bossIds || !Array.isArray(bossIds) || bossIds.length === 0) {
    return res.status(400).json({ message: "Boss IDs array is required" });
  }

  try {
    // Check if event exists
    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // For hosts, verify they own the bosses they're trying to assign
    if (req.user.role === "host") {
      const bosses = await Boss.findAll({
        where: {
          id: bossIds,
          creatorId: req.user.id,
        },
      });

      if (bosses.length !== bossIds.length) {
        return res.status(403).json({
          message: "You can only assign bosses you created",
        });
      }
    } else if (req.user.role === "admin") {
      // Admins can assign any boss, verify bosses exist
      const bosses = await Boss.findAll({
        where: { id: bossIds },
      });

      if (bosses.length !== bossIds.length) {
        return res
          .status(404)
          .json({ message: "One or more bosses not found" });
      }
    }

    // Create EventBoss entries for each boss with unique join codes
    const eventBossData = [];
    for (const bossId of bossIds) {
      try {
        const joinCode = await generateUniqueJoinCode();
        eventBossData.push({
          eventId,
          bossId,
          joinCode,
        });
      } catch (error) {
        console.error(`Error generating join code for boss ${bossId}:`, error);
        return res
          .status(500)
          .json({ message: "Failed to generate unique join codes" });
      }
    }

    // Check for existing assignments to prevent duplicates
    const existingAssignments = await EventBoss.findAll({
      where: {
        eventId,
        bossId: bossIds,
      },
    });

    const existingBossIds = existingAssignments.map((eb) => eb.bossId);
    const newAssignments = eventBossData.filter(
      (eb) => !existingBossIds.includes(eb.bossId)
    );

    if (newAssignments.length === 0) {
      return res.status(400).json({
        message: "All selected bosses are already assigned to this event",
      });
    }

    const createdAssignments = await EventBoss.bulkCreate(newAssignments);

    // Return the created assignments with boss details
    const assignmentsWithBosses = await EventBoss.findAll({
      where: { id: createdAssignments.map((ca) => ca.id) },
      include: [
        {
          model: Boss,
          as: "boss",
          attributes: [
            "id",
            "name",
            "image",
            "description",
            "cooldownDuration",
            "numberOfTeams",
          ],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "username"],
            },
            {
              model: Category,
              as: "Categories",
              through: { attributes: [] },
            },
          ],
        },
      ],
    });

    res.status(201).json({
      message: `${newAssignments.length} boss(es) assigned successfully`,
      assignments: assignmentsWithBosses,
    });
  } catch (error) {
    console.error("Error assigning bosses to event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const unassignBossFromEvent = async (req, res) => {
  const { id: eventId, bossId } = req.params;

  try {
    // Find the event boss assignment
    const eventBoss = await EventBoss.findOne({
      where: { eventId, bossId },
      include: [
        {
          model: Boss,
          as: "boss",
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "username"],
            },
          ],
        },
      ],
    });

    if (!eventBoss) {
      return res.status(404).json({ message: "Boss assignment not found" });
    }

    // For hosts, verify they own the boss they're trying to unassign
    if (req.user.role === "host" && eventBoss.boss.creatorId !== req.user.id) {
      return res.status(403).json({
        message: "You can only unassign bosses you created",
      });
    }

    await eventBoss.destroy();

    res.status(200).json({
      message: "Boss unassigned successfully",
      unassignedBoss: {
        id: eventBoss.boss.id,
        name: eventBoss.boss.name,
      },
    });
  } catch (error) {
    console.error("Error unassigning boss from event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// QR Code generation function
const generateBossQRCode = async (req, res) => {
  const { id: eventId, bossId } = req.params;

  try {
    // Find the event boss assignment
    const eventBoss = await EventBoss.findOne({
      where: { eventId, bossId },
      include: [
        {
          model: Boss,
          as: "boss",
          attributes: ["id", "name", "creatorId"],
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "username"],
            },
          ],
        },
      ],
    });

    if (!eventBoss) {
      return res.status(404).json({ message: "Boss assignment not found" });
    }

    // Check permissions: hosts can only generate QR codes for their own bosses, admins can generate for any
    if (req.user.role === "host" && eventBoss.boss.creatorId !== req.user.id) {
      return res.status(403).json({
        message: "You can only generate QR codes for bosses you created",
      });
    }

    // Generate QR code data URL
    const qrCodeDataURL = await generateBossJoinQRCode(eventBoss.joinCode);

    res.status(200).json({
      message: "QR code generated successfully",
      qrCode: qrCodeDataURL,
      joinCode: eventBoss.joinCode,
      boss: {
        id: eventBoss.boss.id,
        name: eventBoss.boss.name,
        creator: eventBoss.boss.creator.username,
      },
    });
  } catch (error) {
    console.error("Error generating QR code:", error);
    res.status(500).json({ message: "Failed to generate QR code" });
  }
};

// Public events endpoint (no authentication required)
const getPublicEvents = async (req, res) => {
  try {
    const events = await Event.findAll({
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"], // Only include basic creator info
        },
        {
          model: EventBoss,
          as: "eventBosses",
          include: [
            {
              model: Boss,
              as: "boss",
              attributes: [
                "id",
                "name",
                "image",
                "description",
                "numberOfTeams",
              ],
              include: [
                {
                  model: Category,
                  as: "Categories",
                  through: { attributes: [] },
                },
              ],
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 10, // Limit for performance
    });

    // Update status and format datetime for each event
    let eventsWithStatus = await Promise.all(
      events.map(async (event) => {
        const currentStatus = updateEventStatus(event);

        // Update status in database if it has changed
        if (event.status !== currentStatus) {
          await event.update({ status: currentStatus });
        }

        return {
          ...event.toJSON(),
          status: currentStatus,
        };
      })
    );

    if (eventsWithStatus) {
      eventsWithStatus = eventsWithStatus.map((event) => ({
        ...event,
        eventBosses: event.eventBosses.map((eb) => ({
          ...eb,
          boss: eb.boss
            ? {
                ...eb.boss,
                image: eb.boss.image ? getImageUrl(eb.boss.image) : null,
              }
            : null,
        })),
      }));
    }

    res.status(200).json(eventsWithStatus);
  } catch (error) {
    console.error("Error fetching public events:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Public event by ID endpoint (no authentication required)
const getPublicEventById = async (req, res) => {
  const { id } = req.params;
  try {
    const event = await Event.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"], // Only include basic creator info
        },
        {
          model: EventBoss,
          as: "eventBosses",
          include: [
            {
              model: Boss,
              as: "boss",
              attributes: [
                "id",
                "name",
                "image",
                "description",
                "cooldownDuration",
                "numberOfTeams",
              ],
              include: [
                {
                  model: Category,
                  as: "Categories",
                  through: { attributes: [] },
                },
              ],
            },
          ],
        },
      ],
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Update status based on current time
    const currentStatus = updateEventStatus(event);
    if (event.status !== currentStatus) {
      await event.update({ status: currentStatus });
    }

    const eventWithStatus = {
      ...event.toJSON(),
      status: currentStatus,
    };

    if (eventWithStatus.eventBosses) {
      eventWithStatus.eventBosses = eventWithStatus.eventBosses.map((eb) => ({
        ...eb,
        boss: eb.boss
          ? {
              ...eb.boss,
              image: eb.boss.image ? getImageUrl(eb.boss.image) : null,
            }
          : null,
      }));
    }

    res.status(200).json(eventWithStatus);
  } catch (error) {
    console.error("Error fetching public event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  assignBossesToEvent,
  unassignBossFromEvent,
  generateBossQRCode,
  getPublicEvents,
  getPublicEventById,
};
