import { GAME_CONSTANTS } from "../utils/game.constants.js";
import { generateSeed } from "../utils/seed-generator.js";
import RandomGenerator from "../utils/random-generator.js";
import TeamNameGenerator from "../utils/team-name-generator.js";

class TeamManager {
  constructor() {
    this.teams = new Map();
  }

  createTeams(bossSessionId, eventBossId, numberOfTeams) {
    const teamNames = TeamNameGenerator.generateUniqueTeamNames(numberOfTeams, [
      bossSessionId,
      eventBossId,
      numberOfTeams,
      new Date(),
    ]);

    for (let i = 0; i < numberOfTeams; i++) {
      this.teams.set(i + 1, {
        id: i + 1,
        name: teamNames[i],
        players: new Set(),
        totalDamage: 0,
      });
    }
  }
  
  getAllTeams() {
    return Array.from(this.teams.values());
  }

  assignPlayerToTeam(bossSessionId, playerId) {
    const teamArray = this.getAllTeams();

    // Find all the teams with minimum players
    const minPlayerCount = Math.min(...teamArray.map(team => team.players.size));
    const availableTeams = teamArray.filter(team => team.players.size === minPlayerCount);

    // Randomly select one of the available teams
    let selectedTeam;
    if (availableTeams.length > 1) {
      const seed = generateSeed(bossSessionId, playerId, new Date());
      selectedTeam = RandomGenerator.getRandomElement(availableTeams, seed);
    }

    if (selectedTeam) {
      selectedTeam.players.add(playerId);
    }
  }



}

const teamManager = new TeamManager();
export default teamManager;
