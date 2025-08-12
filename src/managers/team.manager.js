import { GAME_CONSTANTS } from "../utils/game.constants.js";
import { generateSeed } from "../utils/seed-generator.js";
import RandomGenerator from "../utils/random-generator.js";
import TeamNameGenerator from "../utils/team-name-generator.js";

class TeamManager {
  constructor() {
    this.teams = new Map();
  }

  createTeams(battleSessionId, eventBossId, numberOfTeams) {
    const teamNames = TeamNameGenerator.generateUniqueTeamNames(numberOfTeams, [
      battleSessionId,
      eventBossId,
      numberOfTeams,
      new Date(),
    ]);

    for (let i = 0; i < numberOfTeams; i++) {
      this.teams.set(i + 1, {
        id: i + 1,
        name: teamNames[i],
        players: new Set(),
      });
    }
  }
  
  getAllTeams() {
    return Array.from(this.teams.values());
  }

  assignPlayerToTeam(battleSessionId, playerId) {
    const teamArray = this.getAllTeams();

    if (teamArray.length === 0) {
      throw new Error("No teams available to assign player to.");
    }
    
    // Find the teams with the minimum number of players
    const minPlayerCount = Math.min(...teamArray.map(team => team.players.size));
    const availableTeams = teamArray.filter(team => team.players.size === minPlayerCount);

    // Randomly select one of the available teams
    let selectedTeam;
    if (availableTeams.length === 1) {
      selectedTeam = availableTeams[0];
    } else {
      const seed = generateSeed([battleSessionId, playerId, new Date()]);
      const rng = new RandomGenerator(seed);
      selectedTeam = rng.getRandomElement(availableTeams);
    }

    selectedTeam.players.add(playerId); // Add player to the selected team
  }

  removePlayerFromTeam(playerId) {
    for (const team of this.teams.values()) {
      if (team.players.has(playerId)) {
        team.players.delete(playerId);
        return;
      }
    }
    throw new Error(`Player with ID ${playerId} not found in any team.`);
  }

  getTeamOfPlayer(playerId) {
    for (const team of this.teams.values()) {
      if (team.players.has(playerId)) {
        return team;
      }
    }
    throw new Error(`Player with ID ${playerId} not found in any team.`);
  }

  getTeamById(teamId) {
    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team with ID ${teamId} not found.`);
    }
    return team;
  }
}

const teamManager = new TeamManager();
export default teamManager;
