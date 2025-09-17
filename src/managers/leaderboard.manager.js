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
    if (!this.teamLeaderboards.has(eventBossId)) {
      this.teamLeaderboards.set(eventBossId, new Map());
    }
    const teamLeaderboard = this.teamLeaderboards.get(eventBossId);

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
    if (!this.individualLeaderboards.has(eventBossId)) {
      this.individualLeaderboards.set(eventBossId, new Map());
    }
    const individualLeaderboard = this.individualLeaderboards.get(eventBossId);
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

  addPlayerToLeaderboard(eventBossId, player) {
    const individualLeaderboard = this.individualLeaderboards.get(eventBossId);
    if (individualLeaderboard.has(player.id)) {
      return;
    }
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
  }

  getLiveLeaderboard(eventBossId) {
    const teamLeaderboard = this.sortLeaderboardByRank(
      this.getTeamLeaderboard(eventBossId)
    );
    const individualLeaderboard = this.sortLeaderboardByRank(
      this.getIndividualLeaderboard(eventBossId)
    );

    return teamLeaderboard.map((team) => ({
      ...team,
      players: individualLeaderboard
        .filter((player) => player.teamId === team.id)
        .map((player) => ({ ...player })),
    }));
  }

  getComprehensiveLiveLeaderboard(eventBossId) {
    const teamLeaderboard = this.getTeamLeaderboard(eventBossId)
      ? this.sortLeaderboardByRank(this.getTeamLeaderboard(eventBossId))
      : null;
    const individualLeaderboard = this.getIndividualLeaderboard(eventBossId)
      ? this.sortLeaderboardByRank(this.getIndividualLeaderboard(eventBossId))
      : null;
    return {
      teamLeaderboard,
      individualLeaderboard,
    };
  }

  updateLiveLeaderboard(eventBossId, playerId, data) {
    console.log("data", data);
    const player = this.getPlayerById(eventBossId, playerId);
    player.totalDamage += data.totalDamage;
    player.correctAnswers += data.correctAnswers;
    player.incorrectAnswers += data.incorrectAnswers;
    player.questionsAnswered += data.questionsAnswered;
    player.accuracy = player.correctAnswers / player.questionsAnswered || 0;
    console.log("player", player);

    const team = this.getTeamById(eventBossId, player.teamId);
    team.totalDamage += data.totalDamage;
    team.correctAnswers += data.correctAnswers;
    team.incorrectAnswers += data.incorrectAnswers;
    team.questionsAnswered += data.questionsAnswered;
    team.accuracy = team.correctAnswers / team.questionsAnswered || 0;
  }

  async finalizeAllTimeLeaderboard(eventBossId) {
    const allTimeLeaderboardData =
      await LeaderboardService.getAllTimeLeaderboard(eventBossId);

    this.resetAllTimeLeaderboard(eventBossId);
    const allTimeLeaderboard = this.getAllTimeLeaderboard(eventBossId);
    allTimeLeaderboardData.forEach((entry) => {
      allTimeLeaderboard.set(entry.playerId, entry);
    });
  }

  getTeamLeaderboard(eventBossId) {
    if (!this.teamLeaderboards.has(eventBossId)) {
      return null;
    }
    const teamLeaderboard = this.teamLeaderboards.get(eventBossId);
    return this.rankLeaderboard(teamLeaderboard);
  }

  getIndividualLeaderboard(eventBossId) {
    if (!this.individualLeaderboards.has(eventBossId)) {
      return null;
    }
    const individualLeaderboard = this.individualLeaderboards.get(eventBossId);
    return this.rankLeaderboard(individualLeaderboard);
  }

  getAllTimeLeaderboard(eventBossId) {
    if (!this.allTimeLeaderboards.has(eventBossId)) {
      throw new Error(
        `All-time leaderboard for event boss ${eventBossId} not found`
      );
    }
    const allTimeLeaderboard = this.allTimeLeaderboards.get(eventBossId);
    return this.rankLeaderboard(allTimeLeaderboard);
  }

  rankLeaderboard(leaderboard) {
    const leaderboardArray = Array.from(leaderboard.values());
    leaderboardArray.sort((a, b) => {
      if (b.totalDamage !== a.totalDamage) {
        return b.totalDamage - a.totalDamage;
      }
      return b.correctAnswers - a.correctAnswers;
    });

    let currentRank = 1;
    let skipCount = 0;

    leaderboardArray[0].rank = currentRank;

    for (let i = 1; i < leaderboardArray.length; i++) {
      const prev = leaderboardArray[i - 1];
      const curr = leaderboardArray[i];

      if (
        curr.totalDamage === prev.totalDamage &&
        curr.correctAnswers === prev.correctAnswers
      ) {
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

  sortLeaderboardByRank(leaderboard) {
    return Array.from(leaderboard.values()).sort((a, b) => a.rank - b.rank);
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

export default LeaderboardManager;
