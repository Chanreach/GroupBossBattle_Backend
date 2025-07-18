export class Leaderboard {
  /**
   * Generate team leaderboard
   */
  static generateTeamLeaderboard(teams) {
    return Array.from(teams.values())
      .sort((a, b) => b.totalDamage - a.totalDamage)
      .map((team) => ({
        teamId: team.teamId,
        name: team.name,
        totalDamage: team.totalDamage,
        playerCount: team.players.size,
        players: Array.from(team.players),
      }));
  }

  /**
   * Generate individual player leaderboard
   */
  static generateIndividualLeaderboard(players) {
    return Array.from(players.values())
      .sort((a, b) => b.totalDamage - a.totalDamage)
      .map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        teamId: player.teamId,
        totalDamage: player.totalDamage,
        questionsAnswered: player.questionsAnswered,
        correctAnswers: player.correctAnswers,
        incorrectAnswers: player.incorrectAnswers,
        hearts: player.hearts,
        status: player.status,
        badges: Array.from(player.badges),
      }));
  }

  /**
   * Get current leaderboard for a session
   */
  static getCurrentLeaderboard(session) {
    const teamLeaderboard = this.generateTeamLeaderboard(session.teams);
    const individualLeaderboard = this.generateIndividualLeaderboard(
      session.players
    );

    return {
      sessionId: session.sessionId,
      bossId: session.bossId,
      teamLeaderboard,
      individualLeaderboard,
      bossHP: session.currentHP,
      maxHP: session.maxHP,
      status: session.status,
      totalDamage: session.totalDamage,
      startTime: session.startTime,
      endTime: session.endTime,
      winner: session.winner,
    };
  }

  /**
   * Get summary leaderboard after boss defeat
   */
  static getSummaryLeaderboard(session) {
    const leaderboard = this.getCurrentLeaderboard(session);

    return {
      ...leaderboard,
      summary: true,
      duration: session.endTime - session.startTime,
      badges: {
        bossDefeated: Array.from(session.badges.bossDefeated),
        lastHit: session.badges.lastHit,
        mvp: session.badges.mvp,
        milestones: Object.fromEntries(session.badges.answerMilestones),
      },
    };
  }

  /**
   * Get all-time leaderboard (would need database integration)
   */
  static getAllTimeLeaderboard(eventId) {
    // This would integrate with your database to get cumulative stats
    // For now, returning a placeholder
    return {
      eventId,
      allTimeLeaderboard: [],
      totalBossesDefeated: 0,
      totalPlayersParticipated: 0,
    };
  }

  /**
   * Get player ranking in current session
   */
  static getPlayerRanking(session, playerId) {
    const individualLeaderboard = this.generateIndividualLeaderboard(
      session.players
    );
    const playerIndex = individualLeaderboard.findIndex(
      (p) => p.playerId === playerId
    );

    if (playerIndex === -1) {
      return null;
    }

    return {
      rank: playerIndex + 1,
      player: individualLeaderboard[playerIndex],
      totalPlayers: individualLeaderboard.length,
    };
  }
}
