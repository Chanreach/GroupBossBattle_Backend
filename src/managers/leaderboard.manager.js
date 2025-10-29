import LeaderboardService from "../services/leaderboard.service.js";
import { compareScores } from "../utils/game.utils.js";

class LeaderboardManager {
  constructor() {
    this.teamLeaderboards = new Map();
    this.individualLeaderboards = new Map();
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
        totalResponseTime: 0,
        averageResponseTime: 0,
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
        profileImage: player.profileImage,
        teamId: player.teamId,
        rank: 0,
        totalDamage: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        questionsAnswered: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        accuracy: 0,
        hearts: 0,
        revivedCount: 0,
      });
    });
  }

  addPlayerToLeaderboard(eventBossId, player) {
    const individualLeaderboard = this.individualLeaderboards.get(eventBossId);
    if (!individualLeaderboard) {
      console.error(
        "[LeaderboardManager] No individual leaderboard found for event boss ID:",
        eventBossId
      );
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

  removePlayerFromLeaderboard(eventBossId, playerId) {
    const individualLeaderboard = this.individualLeaderboards.get(eventBossId);
    if (!individualLeaderboard) {
      console.error(
        "[LeaderboardManager] No individual leaderboard found for event boss ID:",
        eventBossId
      );
      return;
    }

    individualLeaderboard.delete(playerId);
  }

  getLiveLeaderboard(eventBossId) {
    const teamLeaderboard = this.sortLeaderboardByRank(
      this.getTeamLeaderboard(eventBossId)
    );
    const individualLeaderboard = this.sortLeaderboardByRank(
      this.getIndividualLeaderboard(eventBossId)
    );

    if (!teamLeaderboard || !individualLeaderboard) {
      console.error(
        "[LeaderboardManager] Incomplete leaderboard data for event boss ID:",
        eventBossId
      );
      return null;
    }

    return teamLeaderboard.map((team) => ({
      ...team,
      players: individualLeaderboard
        .filter((player) => player.teamId === team.id)
        .map((player) => ({ ...player })),
    }));
  }

  async getComprehensiveLiveLeaderboard(eventBossId) {
    const teamLeaderboard = this.getTeamLeaderboard(eventBossId)
      ? this.sortLeaderboardByRank(this.getTeamLeaderboard(eventBossId))
      : null;
    const individualLeaderboard = this.getIndividualLeaderboard(eventBossId)
      ? this.sortLeaderboardByRank(this.getIndividualLeaderboard(eventBossId))
      : null;
    const allTimeLeaderboard = await this.getEventBossAllTimeLeaderboard(
      eventBossId
    );

    return {
      teamLeaderboard,
      individualLeaderboard,
      allTimeLeaderboard,
    };
  }

  updateLiveLeaderboard(eventBossId, playerId, playerStats, teamStats) {
    const player = this.getPlayerById(eventBossId, playerId);
    if (!player) return;

    player.totalDamage = playerStats.totalDamage;
    player.correctAnswers = playerStats.correctAnswers;
    player.incorrectAnswers = playerStats.incorrectAnswers;
    player.questionsAnswered = playerStats.questionsAnswered;
    player.totalResponseTime = playerStats.totalResponseTime;
    player.averageResponseTime = playerStats.averageResponseTime;
    player.accuracy = playerStats.accuracy;
    player.hearts = playerStats.hearts;
    player.revivedCount = playerStats.revivedCount;

    const team = this.getTeamById(eventBossId, player.teamId);
    if (!team) return;

    team.totalDamage = teamStats.totalDamage;
    team.correctAnswers = teamStats.correctAnswers;
    team.incorrectAnswers = teamStats.incorrectAnswers;
    team.questionsAnswered = teamStats.questionsAnswered;
    team.totalResponseTime = teamStats.totalResponseTime;
    team.averageResponseTime = teamStats.averageResponseTime;
    team.accuracy = teamStats.accuracy;
  }

  async getPlayerStatsByEventId(playerId, eventId) {
    return await LeaderboardService.getPlayerStatsByEventId(playerId, eventId);
  }

  async getEventBossAllTimeLeaderboard(eventBossId) {
    const leaderboard = await LeaderboardService.getEventBossAllTimeLeaderboard(
      eventBossId
    );
    if (!leaderboard || leaderboard.length === 0) {
      return null;
    }

    const eventBossAllTimeLeaderboard = new Map();
    leaderboard.forEach((entry) => {
      eventBossAllTimeLeaderboard.set(entry.userId, entry);
    });
    return this.sortLeaderboardByRank(
      this.rankLeaderboard(eventBossAllTimeLeaderboard)
    );
  }

  async getEventAllTimeLeaderboard(eventId) {
    const leaderboard = await LeaderboardService.getEventAllTimeLeaderboard(
      eventId
    );
    if (!leaderboard || leaderboard.length === 0) {
      return null;
    }

    const eventAllTimeLeaderboard = new Map();
    leaderboard.forEach((entry) => {
      eventAllTimeLeaderboard.set(entry.userId, entry);
    });
    return this.sortLeaderboardByRank(
      this.rankLeaderboard(eventAllTimeLeaderboard)
    );
  }

  async updateEventBossAllTimeLeaderboard(
    playerId,
    eventId,
    eventBossId,
    data
  ) {
    return await LeaderboardService.updateLeaderboardEntry(
      playerId,
      eventId,
      eventBossId,
      data.totalDamage,
      data.correctAnswers,
      data.questionsAnswered
    );
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

  rankLeaderboard(leaderboard) {
    const leaderboardArray = Array.from(leaderboard.values());
    leaderboardArray.sort((a, b) => {
      const scoreA = [
        a.totalDamage ?? a.totalDamageDealt,
        a.accuracy ?? 0,
        -(a.averageResponseTime ?? 0),
        a.hearts ?? 0,
        a.revivedCount ?? 0,
      ];
      const scoreB = [
        b.totalDamage ?? b.totalDamageDealt,
        b.accuracy ?? 0,
        -(b.averageResponseTime ?? 0),
        b.hearts ?? 0,
        b.revivedCount ?? 0,
      ];
      return compareScores(scoreB, scoreA);
    });

    let currentRank = 1;
    let skipCount = 0;

    leaderboardArray[0].rank = currentRank;

    for (let i = 1; i < leaderboardArray.length; i++) {
      const prev = leaderboardArray[i - 1];
      const curr = leaderboardArray[i];

      const prevScore = [
        prev.totalDamage || prev.totalDamageDealt,
        prev.accuracy,
        -prev.averageResponseTime,
        prev.hearts || 0,
        prev.revivedCount || 0,
      ];

      const currScore = [
        curr.totalDamage || curr.totalDamageDealt,
        curr.accuracy,
        -curr.averageResponseTime,
        curr.hearts || 0,
        curr.revivedCount || 0,
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

    return leaderboard;
  }

  sortLeaderboardByRank(leaderboard) {
    return Array.from(leaderboard.values()).sort((a, b) => a.rank - b.rank);
  }

  getTeamById(eventBossId, teamId) {
    const teamLeaderboard = this.getTeamLeaderboard(eventBossId);
    if (!teamLeaderboard.has(teamId)) {
      console.error(
        `[LeaderboardManager] Team with ID ${teamId} not found in leaderboard for event boss ID: ${eventBossId}`
      );
      return null;
    }
    return teamLeaderboard.get(teamId);
  }

  getPlayerById(eventBossId, playerId) {
    const individualLeaderboard = this.getIndividualLeaderboard(eventBossId);
    if (!individualLeaderboard.has(playerId)) {
      console.error(
        `[LeaderboardManager] Player with ID ${playerId} not found in leaderboard for event boss ID: ${eventBossId}`
      );
      return null;
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
}

const leaderboardManager = new LeaderboardManager();
export default leaderboardManager;
