import { User } from "../models/index.js";

export const activityTracker = async (req, res, next) => {
  try {
    if (req.user?.id) {
      await User.update(
        { lastActiveAt: new Date() },
        { where: { id: req.user.id } }
      );
      console.log(`Updated lastActiveAt for user ID: ${req.user.id}`);
      return next();
    }

    const guestId = req.cookies?.guestId;
    if (guestId) {
      res.cookie("guestId", guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });

      await User.update(
        { lastActiveAt: new Date() },
        { where: { id: guestId } }
      );
      console.log(`Updated lastActiveAt for guest user ID: ${guestId}`);
      return next();
    }

    return res.status(401).json({ error: "Guest Session Expired" });
  } catch (error) {
    console.error("Failed to update lastActiveAt:", error);
    next();
  }
};
