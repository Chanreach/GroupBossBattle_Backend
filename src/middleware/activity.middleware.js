import { User } from "../../models/index.js";

export const activityTracker = async (req, res, next) => {
  const requester = req.user;
  const guestId = req.cookies?.guestId;

  try {
    if (!requester?.id) {
      return next();
    }

    const user = await User.findByPk(requester.id);
    if (!user) return next();

    if (user?.isGuest) {
      if (!guestId) {
        return res.status(401).json({ message: "Guest session expired." });
      }

      if (user.id !== guestId) {
        return res.status(401).json({ message: "Invalid guest session." });
      }

      res.cookie("guestId", guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    await user.update({ lastActiveAt: new Date() });
  } catch (error) {
    console.error("Activity Tracker Error:", error);
  } finally {
    next();
  }
};
