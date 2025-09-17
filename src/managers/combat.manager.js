import { GAME_CONSTANTS } from "../utils/game.constants.js";
import {
  initializePlayerStats,
  initializeTeamStats,
  calculateDamage,
} from "../utils/game.utils.js";

class CombatManager {
  initializeTeamStats(combatState, teamId) {
    if (combatState.teamStats.has(teamId)) {
      return;
    }
    combatState.teamStats.set(teamId, initializeTeamStats());
  }

  initializePlayerStats(combatState, playerId) {
    if (combatState.playerStats.has(playerId)) {
      return;
    }
    combatState.playerStats.set(playerId, initializePlayerStats());
  }

  processPlayerAttack(
    combatState,
    eventBoss,
    playerId,
    teamId,
    isCorrect,
    responseTime,
    questionTimeLimit
  ) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    const teamStats = this.getTeamStats(combatState, teamId);
    const { damage, responseCategory } = calculateDamage(isCorrect, responseTime, questionTimeLimit);

    if (damage > 0) {
      this.applyDamage(eventBoss, damage);
      playerStats.totalDamage += damage;
      teamStats.totalDamage += damage;
    }

    if (isCorrect) {
      playerStats.correctAnswers += 1;
      teamStats.correctAnswers += 1;
    } else {
      playerStats.incorrectAnswers += 1;
      teamStats.incorrectAnswers += 1;
      this.deductPlayerHearts(combatState, playerId);
    }

    playerStats.questionsAnswered += 1;
    teamStats.questionsAnswered += 1;

    return {
      isCorrect,
      damage,
      responseCategory,
      playerHearts: playerStats.hearts,
      eventBossCurrentHP: eventBoss.currentHP,
    };
  }

  processQuestionTimeout(combatState, eventBoss, playerId, teamId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    const teamStats = this.getTeamStats(combatState, teamId);

    playerStats.incorrectAnswers += 1;
    teamStats.incorrectAnswers += 1;

    playerStats.questionsAnswered += 1;
    teamStats.questionsAnswered += 1;

    this.deductPlayerHearts(combatState, playerId);

    return {
      isCorrect: false,
      damage: 0,
      responseCategory: "TIMEOUT",
      playerHearts: playerStats.hearts,
      eventBossCurrentHP: eventBoss.currentHP,
    }
  }

  applyDamage(eventBoss, damage) {
    eventBoss.currentHP = Math.max(0, eventBoss.currentHP - damage);
    return eventBoss.currentHP;
  }

  deductPlayerHearts(combatState, playerId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    playerStats.hearts = Math.max(0, playerStats.hearts - 1);
    return playerStats.hearts;
  }

  getCombatState(battleSession) {
    if (!battleSession.combat) {
      throw new Error("Combat session not found");
    }
    return battleSession.combat;
  }

  getPlayerStats(combatState, playerId) {
    if (!combatState.playerStats.has(playerId)) {
      throw new Error(`Player with ID ${playerId} not found in combat session`);
    }
    return combatState.playerStats.get(playerId);
  }

  getTeamStats(combatState, teamId) {
    if (!combatState.teamStats.has(teamId)) {
      throw new Error(`Team with ID ${teamId} not found in combat session`);
    }
    return combatState.teamStats.get(teamId);
  }

  getPlayerHearts(combatState, playerId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    return playerStats.hearts;
  }

  restorePlayerHearts(combatState, playerId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    playerStats.hearts = GAME_CONSTANTS.PLAYER_STARTING_HEARTS;
  }

  resetPlayerStats(combatState, playerId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    Object.assign(playerStats, initializePlayerStats());
  }
}

export default CombatManager;
