import { GAME_CONSTANTS } from "../utils/constants.js";

export class TeamManager {
  /**
   * Initialize teams for a boss fight session
   */
  static initializeTeams(numberOfTeams) {
    const teams = new Map();
    const teamDamage = new Map();

    for (let i = 1; i <= numberOfTeams; i++) {
      teams.set(i, {
        teamId: i,
        players: new Set(),
        totalDamage: 0,
        name: `Team ${i}`,
      });
      teamDamage.set(i, 0);
    }

    return { teams, teamDamage };
  }

  /**
   * Assign player to team with load balancing
   */
  static assignPlayerToTeam(teams, playerId) {
    const teamArray = Array.from(teams.values());

    // Find team with least players
    let minPlayersTeam = teamArray[0];
    for (const team of teamArray) {
      if (team.players.size < minPlayersTeam.players.size) {
        minPlayersTeam = team;
      }
    }

    // Add player to team
    minPlayersTeam.players.add(playerId);

    return minPlayersTeam.teamId;
  }

  /**
   * Remove player from team
   */
  static removePlayerFromTeam(teams, playerId, teamId) {
    const team = teams.get(teamId);
    if (team) {
      team.players.delete(playerId);
    }
  }

  /**
   * Get team statistics
   */
  static getTeamStats(teams) {
    return Array.from(teams.values()).map((team) => ({
      teamId: team.teamId,
      name: team.name,
      playerCount: team.players.size,
      totalDamage: team.totalDamage,
      players: Array.from(team.players),
    }));
  }

  /**
   * Get winning team based on damage
   */
  static getWinningTeam(teamDamage) {
    let winningTeam = null;
    let maxDamage = 0;

    for (const [teamId, damage] of teamDamage) {
      if (damage > maxDamage) {
        maxDamage = damage;
        winningTeam = teamId;
      }
    }

    return { winningTeam, maxDamage };
  }

  /**
   * Reset team damage for new fight
   */
  static resetTeamDamage(teams, teamDamage) {
    for (const teamId of teams.keys()) {
      teamDamage.set(teamId, 0);
      teams.get(teamId).totalDamage = 0;
    }
  }

  /**
   * Update team damage
   */
  static updateTeamDamage(teams, teamDamage, teamId, damage) {
    const currentDamage = teamDamage.get(teamId) || 0;
    teamDamage.set(teamId, currentDamage + damage);

    const team = teams.get(teamId);
    if (team) {
      team.totalDamage += damage;
    }

    return team?.totalDamage || 0;
  }

  /**
   * Check if teams have minimum players for battle
   */
  static canStartBattle(teams, readyPlayers) {
    const teamsWithPlayers = new Set(readyPlayers.map((p) => p.teamId));
    return readyPlayers.length >= 2 && teamsWithPlayers.size >= 2;
  }
}
