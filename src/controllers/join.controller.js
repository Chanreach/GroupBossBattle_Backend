import { EventBoss, Boss } from "../models/index.js";
import PRNG from "../utils/prng.js";
import crypto from "crypto";

// Animal Name for Teams
const Teams = [
  "Lions",
  "Tigers",
  "Bears",
  "Wolves",
  "Eagles",
  "Sharks",
  "Dragons",
  "Phoenixes",
  "Unicorns",
  "Griffins",
  "Hawks",
  "Panthers",
  "Cobras",
  "Rhinos",
  "Falcons",
];

const joinBossFight = async (req, res) => {
  const { joinCode, nickname } = req.body;

  if (!joinCode || !nickname) {
    return res
      .status(400)
      .json({ message: "Join code and nickname are required" });
  }

  try {
    // Find the event boss by join code
    const eventBoss = await EventBoss.findOne({
      where: { joinCode },
      include: [{ model: Boss, as: "boss" }],
    });

    if (!eventBoss) {
      return res.status(404).json({ message: "Event boss not found" });
    }

    const boss = await Boss.findByPk(eventBoss.bossId);

    if (!boss) {
      return res.status(404).json({ message: "Boss not found" });
    }

    const prng = new PRNG();
    const teamList = Teams.slice(0, boss.numberOfTeams);
    const assignedTeam = prng.randomChoice(teamList);

    const playerId = crypto.randomUUID();

    return res.status(200).json({
      message: "Successfully joined the boss fight",
      data: {
        playerId,
        nickname,
        team: assignedTeam,
        joinCode: eventBoss.joinCode,
        boss: {
          name: boss.name,
          cooldownDuration: boss.cooldownDuration,
          numberOfTeams: boss.numberOfTeams,
        },
      },
    });
  } catch (error) {
    console.error("Error joining boss fight:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  joinBossFight,
};
