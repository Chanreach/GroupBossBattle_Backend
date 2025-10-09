import {
  UserBadge,
  Badge,
  Event,
  EventBoss,
  Boss,
  Leaderboard,
  User,
} from "../models/index.js";
import { Op } from "sequelize";
import { getImageUrl } from "../utils/image.utils.js";

const getBossDefeatedCount = (userBadges) => {
  return userBadges.filter((ub) => ub.badge?.code === "boss-defeated").length;
};

const getAllUserBadges = async (req, res) => {
  try {
    const userId = req.user.id;

    const [events, badges, eventBosses, userBadges, leaderboards] =
      await Promise.all([
        Event.findAll({
          where: { status: { [Op.ne]: "upcoming" } },
          order: [["startTime", "DESC"]],
        }),
        Badge.findAll(),
        EventBoss.findAll({ include: [{ model: Boss, as: "boss" }] }),
        UserBadge.findAll({ where: { userId }, include: [{ model: Badge, as: "badge" }] }),
        Leaderboard.findAll({ where: { userId } }),
      ]);
    console.log("Fetched data:", userBadges.length);
    userBadges.forEach((ub) => {
      console.log(`UserBadge: ${ub.id}, Badge: ${ub.badge ? ub.badge.name : 'N/A'}`);
    });

    const achievementBadges = badges
      .filter((b) => b.type === "achievement")
      .sort((a, b) => a.name.localeCompare(b.name));
    const milestoneBadges = badges
      .filter((b) => b.type === "milestone")
      .sort((a, b) => {
        const aHasThreshold = a.threshold !== null && a.threshold !== undefined;
        const bHasThreshold = b.threshold !== null && b.threshold !== undefined;

        if (aHasThreshold && !bHasThreshold) return -1;
        if (!aHasThreshold && bHasThreshold) return 1;
        if (!aHasThreshold && !bHasThreshold)
          return a.name.localeCompare(b.name);

        return a.threshold - b.threshold;
      });

    const eventBossesByEvent = eventBosses.reduce((acc, eb) => {
      if (!acc[eb.eventId]) {
        acc[eb.eventId] = [];
      }
      acc[eb.eventId].push(eb);
      return acc;
    }, {});
    const userBadgesByEvent = userBadges.reduce((acc, ub) => {
      if (!acc[ub.eventId]) {
        acc[ub.eventId] = [];
      }
      acc[ub.eventId].push(ub);
      return acc;
    }, {});
    const leaderboardsByEvent = leaderboards.reduce((acc, lb) => {
      if (!acc[lb.eventId]) {
        acc[lb.eventId] = [];
      }
      acc[lb.eventId].push(lb);
      return acc;
    }, {});

    console.log("User Badges by Event:", userBadgesByEvent);

    const formattedEvents = [];
    for (const event of events) {
      const eventBossesList = eventBossesByEvent[event.id] || [];
      const userBadgesForEvent = userBadgesByEvent[event.id] || [];
      const leaderboardsForEvent = leaderboardsByEvent[event.id] || [];

      console.log(`Processing Event: ${event.name}, UserBadges: ${userBadgesForEvent.length}`);

      const milestoneBadgesData = milestoneBadges.map((mb) => {
        const userBadge = userBadgesForEvent.find(
          (ub) => ub.badgeId === mb.id && ub.eventBossId === null
        );
        console.log(`Milestone Badge: ${mb.name}, UserBadge: ${userBadge ? userBadge.badge.name : 'N/A'}`);
        return {
          id: mb.id,
          name: mb.name,
          image: mb.image,
          description: mb.description,
          code: mb.code,
          type: mb.type,
          threshold: mb.threshold,
          earnedAt: userBadge?.earnedAt || null,
          isRedeemed: userBadge?.isRedeemed || false,
          isEarned: !!userBadge,
          progress:
            mb.code === "hero"
              ? getBossDefeatedCount(userBadgesForEvent)
              : leaderboardsForEvent?.reduce(
                  (acc, lb) => acc + lb.totalCorrectAnswers,
                  0
                ) || 0,
          target: mb.code === "hero" ? eventBossesList.length : mb.threshold,
        };
      });

      const bossesData = eventBossesList.map((eventBoss) => {
        const userBadgesForBoss = userBadgesForEvent.filter(
          (ub) => ub.eventBossId === eventBoss.id
        );

        const bossBadges = achievementBadges.map((ab) => {
          const userBadge = userBadgesForBoss.find(
            (ub) => ub.badgeId === ab.id
          );
          return {
            id: ab.id,
            name: ab.name,
            image: ab.image,
            description: ab.description,
            code: ab.code,
            type: ab.type,
            threshold: ab.threshold,
            earnedAt: userBadge?.earnedAt || null,
            isRedeemed: userBadge?.isRedeemed || false,
            isEarned: !!userBadge,
          };
        });

        return {
          id: eventBoss.id,
          name: eventBoss.boss.name,
          totalUserBadges: userBadgesForBoss.length,
          maxBadges: achievementBadges.length,
          badges: bossBadges,
        };
      });

      const totalUserBadges =
        milestoneBadgesData.filter((mb) => mb.isEarned).length +
        bossesData.reduce((sum, b) => sum + b.totalUserBadges, 0);

      formattedEvents.push({
        id: event.id,
        name: event.name,
        status: event.status,
        startTime: event.startTime,
        endTime: event.endTime,
        totalEventBosses: eventBossesByEvent[event.id]?.length || 0,
        totalUserBadges: totalUserBadges,
        maxMilestoneBadges: milestoneBadges.length,
        maxBadges:
          milestoneBadges.length +
          eventBossesByEvent[event.id]?.length * achievementBadges.length,
        eventBosses: bossesData,
        milestoneBadges:
          !eventBossesByEvent[event.id] ||
          eventBossesByEvent[event.id].length === 0
            ? []
            : milestoneBadgesData,
        totalMilestoneBadges: milestoneBadgesData.filter((mb) => mb.isEarned)
          .length,
      });
    }
    res.status(200).json({
      events: formattedEvents,
    });
  } catch (error) {
    console.error("Error fetching user badges:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAllUserBadgesByEventId = async (req, res) => {
  try {
    const userId = req.user.id;
    const { eventId } = req.params;
    if (!eventId) {
      return res.status(400).json({ message: "eventId is required" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [event, badges, userBadges] = await Promise.all([
      Event.findByPk(eventId),
      Badge.findAll(),
      UserBadge.findAll({
        where: { eventId },
        include: [{ model: User, as: "user" }],
      }),
    ]);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    const achievementBadges = badges
      .filter((b) => b.type === "achievement")
      .sort((a, b) => a.name.localeCompare(b.name));
    const milestoneBadges = badges
      .filter((b) => b.type === "milestone")
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalBadgesEarned = userBadges.length;
    const totalBadgesRedeemed = userBadges.filter((ub) => ub.isRedeemed).length;

    let eventBosses = [];
    if (user.role === "admin") {
      eventBosses = await EventBoss.findAll({
        where: { eventId },
        include: [{ model: Boss, as: "boss" }],
      });
    } else if (user.role === "host") {
      const createdBosses = await Boss.findAll({
        where: { createdBy: userId },
      });
      const createdBossIds = createdBosses.map((b) => b.id);
      eventBosses = await EventBoss.findAll({
        where: { eventId, bossId: { [Op.in]: createdBossIds } },
        include: [{ model: Boss, as: "boss" }],
      });
    }

    const usersMap = new Map();
    for (const ub of userBadges) {
      const userEntry = usersMap.get(ub.userId) || {
        id: ub.user.id,
        name: ub.user.username,
        profileImage: ub.user.profileImage ? getImageUrl(ub.user.profileImage) : null,
        eventBosses: [],
        milestoneBadges: [],
      };
      usersMap.set(ub.userId, userEntry);
    }

    for (const [userId, userEntry] of usersMap.entries()) {
      const userBadgesForUser = userBadges.filter((ub) => ub.userId === userId);

      userEntry.milestoneBadges = milestoneBadges.map((mb) => {
        const userBadge = userBadgesForUser.find(
          (ub) => ub.badgeId === mb.id && ub.eventBossId === null
        );
        return {
          id: mb.id,
          name: mb.name,
          image: mb.image,
          description: mb.description,
          code: mb.code,
          type: mb.type,
          threshold: mb.threshold,
          earnedAt: userBadge?.earnedAt || null,
          isRedeemed: userBadge?.isRedeemed || false,
          isEarned: !!userBadge,
          userBadgeId: userBadge?.id || null,
        };
      });

      userEntry.eventBosses = eventBosses.map((eventBoss) => {
        const userBadgesForBoss = userBadgesForUser.filter(
          (ub) => (ub.eventBossId = eventBoss.id)
        );

        const badges = achievementBadges.map((ab) => {
          const userBadge = userBadgesForBoss.find(
            (ub) => ub.badgeId === ab.id
          );
          return {
            id: ab.id,
            name: ab.name,
            image: ab.image,
            description: ab.description,
            code: ab.code,
            type: ab.type,
            threshold: ab.threshold,
            earnedAt: userBadge?.earnedAt || null,
            isRedeemed: userBadge?.isRedeemed || false,
            isEarned: !!userBadge,
            userBadgeId: userBadge?.id || null,
          };
        });

        return {
          id: eventBoss.id,
          name: eventBoss.boss.name,
          badges,
        };
      });

      usersMap.set(userId, userEntry);
    }

    const users = Array.from(usersMap.values());

    res.status(200).json({
      event: {
        id: event.id,
        name: event.name,
        status: event.status,
        startTime: event.startTime,
        endTime: event.endTime,
        totalEventBosses: eventBosses.length,
        totalBadgesEarned,
        totalBadgesRedeemed,
      },
      eventBosses,
      users,
    });
  } catch (error) {
    console.error("Error fetching user badges by event ID:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateUserBadge = async (req, res) => {
  try {
    const userId = req.user.id;
    const isRedeemed = req.body.isRedeemed;
    const { id } = req.params;
    if (!id) {
      console.error("User Badge ID is required");
      return res.status(400).json({ message: "User Badge ID is required" });
    }

    const [user, userBadge] = await Promise.all([
      User.findByPk(userId),
      UserBadge.findByPk(id, {
        include: [
          {
            model: Badge,
            as: "badge",
          },
        ],
      }),
    ]);
    if (!userBadge) {
      console.error("User Badge not found.");
      return res.status(404).json({ message: "User Badge not found." });
    }

    if (user.role === "host" && userBadge.badge.type === "milestone") {
      console.error("Host users are not allowed to update milestone badges.");
      return res
        .status(401)
        .json({ message: "You are not allowed to perform this action." });
    }

    if (userBadge.isRedeemed === isRedeemed) {
      console.error("No changes needed.");
      return res.status(200).json({ message: "No changes needed." });
    }

    userBadge.isRedeemed = isRedeemed;
    await userBadge.save();
    res
      .status(200)
      .json({ message: "User Badge has been updated successfully." });
  } catch (error) {
    console.error("Error updating user badge by ID: ", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default { getAllUserBadges, updateUserBadge, getAllUserBadgesByEventId };
