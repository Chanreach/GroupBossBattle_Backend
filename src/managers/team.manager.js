import { GAME_CONSTANTS } from "../utils/game.constants.js";
import { generateSeed } from "../utils/generate-seed.js";
import RandomGenerator from "../utils/random-generator.js";
import TeamNameGenerator from "../utils/team-name-generator.js";

class TeamManager {
  createTeams(teams, battleSessionId, eventBossId, numberOfTeams) {
    if (!teams || !battleSessionId || !eventBossId || !numberOfTeams) {
      console.error("Missing parameters to create teams");
      return null;
    }

    const teamNames = TeamNameGenerator.generateUniqueTeamNames(numberOfTeams, [
      battleSessionId,
      eventBossId,
      numberOfTeams,
      new Date(),
    ]);

    for (let i = 0; i < numberOfTeams; i++) {
      teams.set(i + 1, {
        id: i + 1,
        name: teamNames[i],
        players: new Set(),
      });
    }
    return this.getAllTeams(teams);
  }

  getAllTeams(teams) {
    return Array.from(teams.values());
  }

  assignPlayerToTeam(teams, battleSessionId, playerId) {
    const teamArray = this.getAllTeams(teams);
    if (teamArray.length === 0) {
      console.error("No teams available to assign player to.");
      return null;
    }

    const minPlayerCount = Math.min(
      ...teamArray.map((team) => team.players.size)
    );
    const availableTeams = teamArray.filter(
      (team) => team.players.size === minPlayerCount
    );

    let selectedTeam;
    if (availableTeams.length === 1) {
      selectedTeam = availableTeams[0];
    } else {
      const seed = generateSeed([battleSessionId, playerId, new Date()]);
      const rng = new RandomGenerator(seed);
      selectedTeam = rng.getRandomElement(availableTeams);
    }
    selectedTeam.players.add(playerId);
    return selectedTeam.id;
  }

  removePlayerFromTeam(teams, playerId) {
    for (const team of this.getAllTeams(teams)) {
      if (team.players.has(playerId)) {
        team.players.delete(playerId);
        return team;
      }
    }
    console.error(`Player with ID ${playerId} not found in any team.`);
    return null;
  }

  getTeamOfPlayer(teams, playerId) {
    for (const team of this.getAllTeams(teams)) {
      if (team.players.has(playerId)) {
        return team;
      }
    }
    console.error(`Player with ID ${playerId} not found in any team.`);
    return null;
  }

  getTeamById(teams, teamId) {
    const team = teams.get(teamId);
    if (!team) {
      console.error(`Team with ID ${teamId} not found.`);
    }
    return team;
  }

  getTeamNameById(teams, teamId) {
    return this.getTeamById(teams, teamId).name;
  }

  getPlayersInTeam(teams, teamId) {
    const team = this.getTeamById(teams, teamId);
    return Array.from(team.players);
  }
}

export default TeamManager;
