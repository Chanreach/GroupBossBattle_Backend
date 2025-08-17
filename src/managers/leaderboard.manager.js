import LeaderboardService from "../services/leaderboard.service.js";

class LeaderboardManager {
  constructor() {
    this.teamLeaderboards = new Map();
    this.individualLeaderboards = new Map();
    this.allTimeLeaderboards = new Map();
  }

  async initializeAllTimeLeaderboard() {
    const allTimeData = await LeaderboardService.getAllTimeLeaderboard();
    allTimeData.forEach((entry) => {
      this.allTimeLeaderboards.set(entry.playerId, entry);
    });
  }

  initializeTeamLeaderboard(eventBossId, teams) {
    const teamLeaderboard = this.getTeamLeaderboard(eventBossId);

    teams.forEach((team) => {
      teamLeaderboard.set(team.id, {
        id: team.id,
        rank: 0,
        name: team.name,
        totalDamage: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        questionsAnswered: 0,
        accuracy: 0,
      });
    });
  }

  initializeIndividualLeaderboard(eventBossId, players) {
    const individualLeaderboard = this.getIndividualLeaderboard(eventBossId);
    players.forEach((player) => {
      individualLeaderboard.set(player.id, {
        id: player.id,
        nickname: player.nickname,
        teamId: player.teamId,
        rank: 0,
        totalDamage: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        questionsAnswered: 0,
        accuracy: 0,
      });
    });
  }

  updateLiveLeaderboard(eventBossId, playerId, data) {
    const player = this.getPlayerById(eventBossId, playerId);
    player.totalDamage += data.totalDamage;
    player.correctAnswers += data.correctAnswers;
    player.incorrectAnswers += data.incorrectAnswers;
    player.questionsAnswered += data.questionsAnswered;
    player.accuracy = player.correctAnswers / player.questionsAnswered || 0;

    const team = this.getTeamById(eventBossId, player.teamId);
    team.totalDamage += data.totalDamage;
    team.correctAnswers += data.correctAnswers;
    team.incorrectAnswers += data.incorrectAnswers;
    team.questionsAnswered += data.questionsAnswered;
    team.accuracy = team.correctAnswers / team.questionsAnswered || 0;
  }

  async finalizeAllTimeLeaderboard(eventBossId) {
    const allTimeLeaderboardData = await LeaderboardService.getAllTimeLeaderboard(eventBossId);
    
    this.resetAllTimeLeaderboard(eventBossId);
    const allTimeLeaderboard = this.getAllTimeLeaderboard(eventBossId);
    allTimeLeaderboardData.forEach((entry) => {
      allTimeLeaderboard.set(entry.playerId, entry);
    });
  }

  getTeamLeaderboard(eventBossId) {
    if (!this.teamLeaderboards.has(eventBossId)) {
      this.teamLeaderboards.set(eventBossId, new Map());
    }
    const teamLeaderboard = this.teamLeaderboards.get(eventBossId);
    this.rankLeaderboard(teamLeaderboard);
    return teamLeaderboard;
  }

  getIndividualLeaderboard(eventBossId) {
    if (!this.individualLeaderboards.has(eventBossId)) {
      this.individualLeaderboards.set(eventBossId, new Map());
    }
    const individualLeaderboard = this.individualLeaderboards.get(eventBossId);
    this.rankLeaderboard(individualLeaderboard);
    return individualLeaderboard;
  }

  getAllTimeLeaderboard(eventBossId) {
    if (!this.allTimeLeaderboards.has(eventBossId)) {
      this.allTimeLeaderboards.set(eventBossId, new Map());
    }
    const allTimeLeaderboard = this.allTimeLeaderboards.get(eventBossId);
    this.rankLeaderboard(allTimeLeaderboard);
    return allTimeLeaderboard;
  }

  rankLeaderboard(leaderboard) {
    leaderboard = Array.from(leaderboard.values());
    leaderboard.sort((a, b) => {
      if (b.totalDamage !== a.totalDamage) {
        return b.totalDamage - a.totalDamage;
      }
      return b.correctAnswers - a.correctAnswers;
    })
    
    let currentRank = 1;
    let skipCount = 0;

    leaderboard[0].rank = currentRank;

    for (let i = 1; i < leaderboard.length; i++) {
      const prev = leaderboard[i - 1];
      const curr = leaderboard[i];

      if (curr.totalDamage === prev.totalDamage && curr.correctAnswers === prev.correctAnswers) {
        curr.rank = currentRank;
        skipCount++;
      } else {
        currentRank += skipCount + 1;
        curr.rank = currentRank;
        skipCount = 0;
      }
    }

    return leaderboard;
  }

  getTeamById(eventBossId, teamId) {
    const teamLeaderboard = this.getTeamLeaderboard(eventBossId);
    if (!teamLeaderboard.has(teamId)) {
      throw new Error(
        `Team with ID ${teamId} not found in leaderboard for event boss ${eventBossId}`
      );
    }
    return teamLeaderboard.get(teamId);
  }

  getPlayerById(eventBossId, playerId) {
    const individualLeaderboard = this.getIndividualLeaderboard(eventBossId);
    if (!individualLeaderboard.has(playerId)) {
      throw new Error(
        `Player with ID ${playerId} not found in leaderboard for event boss ${eventBossId}`
      );
    }
    return individualLeaderboard.get(playerId);
  }

  resetTeamLeaderboard(eventBossId) {
    const teamLeaderboard = this.getTeamLeaderboard(eventBossId);
    teamLeaderboard.clear();
  }

  resetIndividualLeaderboard(eventBossId) {
    const individualLeaderboard = this.getIndividualLeaderboard(eventBossId);
    individualLeaderboard.clear();
  }

  resetAllTimeLeaderboard(eventBossId) {
    const allTimeLeaderboard = this.getAllTimeLeaderboard(eventBossId);
    allTimeLeaderboard.clear();
  }
}

const leaderboardManager = new LeaderboardManager();
export default leaderboardManager;
