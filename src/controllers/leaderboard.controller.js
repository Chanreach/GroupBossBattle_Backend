import { Leaderboard, User, Event } from "../models/index.js";
import { Op, fn, col, literal } from "sequelize";
import { compareScores } from "../utils/game.utils.js";

const rankLeaderboard = (entries) => {
  entries.sort((a, b) => {
    const scoreA = [a.totalDamageDealt, a.accuracy, a.totalBattlesParticipated];
    const scoreB = [b.totalDamageDealt, b.accuracy, b.totalBattlesParticipated];
    return compareScores(scoreB, scoreA);
  });

  let currentRank = 1;
  let skipCount = 0;
  entries[0].rank = currentRank;

  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];

    const prevScore = [
      prev.totalDamageDealt,
      prev.accuracy,
      prev.totalBattlesParticipated,
    ];
    const currScore = [
      curr.totalDamageDealt,
      curr.accuracy,
      curr.totalBattlesParticipated,
    ];

    if (compareScores(currScore, prevScore) === 0) {
      curr.rank = currentRank;
      skipCount++;
    } else {
      currentRank += skipCount + 1;
      curr.rank = currentRank;
      skipCount = 0;
    }
  }

  entries.sort((a, b) => a.rank - b.rank);
  return entries;
};

const getEventAllTimeLeaderboard = async (eventId) => {
  try {
    const leaderboardEntries = await Leaderboard.findAll({
      where: { eventId: eventId },
      attributes: [
        "userId",
        "eventId",
        [fn("SUM", col("total_damage_dealt")), "totalDamageDealt"],
        [fn("SUM", col("total_correct_answers")), "totalCorrectAnswers"],
        [fn("SUM", col("total_questions_answered")), "totalQuestionsAnswered"],
        [
          fn("SUM", col("total_battles_participated")),
          "totalBattlesParticipated",
        ],
        [
          literal(
            "ROUND(SUM(total_correct_answers) / NULLIF(SUM(total_questions_answered), 0), 4)"
          ),
          "accuracy",
        ],
      ],
      group: ["userId", "eventId"],
      order: [
        ["totalDamageDealt", "DESC"],
        ["accuracy", "DESC"],
        ["totalBattlesParticipated", "DESC"],
      ],
    });

    const enrichedEntries = await Promise.all(
      leaderboardEntries.map(async (entry) => {
        let username = "Unknown Player";
        let profileImage = null;
        let userId = null;
        try {
          const user = await User.findByPk(entry.userId);
          if (user) {
            username = user.username;
            userId = user.id;
            profileImage = user.profileImage;
          }
        } catch (lookupError) {
          console.warn(`Could not resolve player name for ID ${entry.userId}`);
        }
        return {
          userId,
          eventId: entry.eventId,
          username,
          profileImage,
          totalDamageDealt: Number(entry.get("totalDamageDealt")),
          totalCorrectAnswers: Number(entry.get("totalCorrectAnswers")),
          totalQuestionsAnswered: Number(entry.get("totalQuestionsAnswered")),
          totalBattlesParticipated: Number(
            entry.get("totalBattlesParticipated")
          ),
          accuracy: Number(entry.get("accuracy")) || 0,
          rank: 0,
        };
      })
    );

    const rankedEntries = rankLeaderboard(enrichedEntries);
    return rankedEntries;
  } catch (error) {
    console.error("Error fetching all-time leaderboard:", error);
    throw new Error(error);
  }
};

const getAllEventAllTimeLeaderboards = async (req, res) => {
  try {
    const events = await Event.findAll({
      where: { status: { [Op.ne]: "upcoming" } },
    });
    const allLeaderboards = {};
    for (const event of events) {
      const leaderboard = await getEventAllTimeLeaderboard(event.id);
      allLeaderboards[event.id] = leaderboard;
    }
    res.status(200).json({
      leaderboards: allLeaderboards,
      events: events.map((event) => ({
        id: event.id,
        name: event.name,
        status: event.status,
      })),
    });
  } catch (error) {
    console.error("Error fetching all-time leaderboard:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export default { getAllEventAllTimeLeaderboards };
