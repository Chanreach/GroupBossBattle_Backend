import { Event } from "../../models/index.js";

export const checkEventOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requestor = req.user;

    if (["admin", "superadmin"].includes(requestor.role)) {
      return next();
    }

    const event = await Event.findByPk(id);
    if (!event) return res.status(404).json({ message: "Event not found." });

    if (event.creatorId !== requestor.id) {
      return res
        .status(403)
        .json({ message: "Forbidden: You can only manage your own events." });
    }

    next();
  } catch (error) {
    console.error("Checking event ownership error:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getEventFilter = (req, res, next) => {
  req.eventFilter = {};
  next();
};
