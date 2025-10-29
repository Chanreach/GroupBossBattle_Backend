import { GAME_CONSTANTS } from "../utils/game.constants.js";
import {
  initializePlayerStats,
  initializeTeamStats,
  calculateDamage,
} from "../utils/game.utils.js";

class CombatManager {
  initializeTeamStats(combatState, teamId) {
    combatState.teamStats.set(teamId, initializeTeamStats());
  }

  initializePlayerStats(combatState, playerId) {
    combatState.playerStats.set(playerId, initializePlayerStats());
  }

  processPlayerAttack(
    combatState,
    eventBoss,
    achievementAwards,
    playerId,
    teamId,
    isCorrect,
    responseTime,
    questionTimeLimit
  ) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    const teamStats = this.getTeamStats(combatState, teamId);
    if (!playerStats || !teamStats) {
      return null;
    }
    
    const { damage, responseCategory } = calculateDamage(
      isCorrect,
      responseTime,
      questionTimeLimit
    );

    if (damage > 0) {
      const actualDamage = Math.min(damage, eventBoss.currentHP);
      const remainingHP = this.applyDamage(eventBoss, actualDamage);
      if (remainingHP === null) {
        console.error("[CombatManager] Failed to apply damage to event boss.");
        return null;
      }

      playerStats.totalDamage += actualDamage;
      teamStats.totalDamage += actualDamage;

      if (remainingHP <= 0) {
        achievementAwards.lastHit = playerId;
      }
    }

    if (isCorrect) {
      playerStats.correctAnswers += 1;
      teamStats.correctAnswers += 1;

      playerStats.totalResponseTime += responseTime;
      teamStats.totalResponseTime += responseTime;
    } else {
      playerStats.incorrectAnswers += 1;
      teamStats.incorrectAnswers += 1;
      
      const remainingHearts = this.deductPlayerHearts(combatState, playerId);
      if (remainingHearts === null) {
        console.error("[CombatManager] Failed to deduct player hearts.");
        return null;
      }
    }

    playerStats.questionsAnswered += 1;
    playerStats.averageResponseTime =
      playerStats.totalResponseTime / playerStats.questionsAnswered;
    playerStats.accuracy =
      playerStats.correctAnswers / playerStats.questionsAnswered;

    teamStats.questionsAnswered += 1;
    teamStats.averageResponseTime =
      teamStats.totalResponseTime / teamStats.questionsAnswered;
    teamStats.accuracy = teamStats.correctAnswers / teamStats.questionsAnswered;

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
    if (!playerStats || !teamStats) {
      return null;
    }

    playerStats.incorrectAnswers += 1;
    teamStats.incorrectAnswers += 1;

    playerStats.questionsAnswered += 1;
    teamStats.questionsAnswered += 1;

    const remainingHearts = this.deductPlayerHearts(combatState, playerId);
    if (remainingHearts === null) {
      console.error("[CombatManager] Failed to deduct player hearts.");
      return null;
    }

    return {
      isCorrect: false,
      damage: 0,
      responseCategory: "TIMEOUT",
      playerHearts: remainingHearts,
      eventBossCurrentHP: eventBoss.currentHP,
    };
  }

  applyDamage(eventBoss, damage) {
    if (!eventBoss) {
      console.error("[CombatManager] Event boss not found.");
      return null;
    }

    eventBoss.currentHP = Math.max(0, eventBoss.currentHP - damage);
    return eventBoss.currentHP;
  }

  deductPlayerHearts(combatState, playerId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    if (!playerStats) {
      return null;
    }

    playerStats.hearts = Math.max(0, playerStats.hearts - 1);
    return playerStats.hearts;
  }

  getPlayerStats(combatState, playerId) {
    if (!combatState.playerStats.has(playerId)) {
      console.error(`[CombatManager] Player with ID ${playerId} not found in combat session.`);
      return null;
    }
    return combatState.playerStats.get(playerId);
  }

  getTeamStats(combatState, teamId) {
    if (!combatState.teamStats.has(teamId)) {
      console.error(`[CombatManager] Team with ID ${teamId} not found in combat session.`);
      return null;
    }
    return combatState.teamStats.get(teamId);
  }

  getPlayerHearts(combatState, playerId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    return playerStats?.hearts ?? 0;
  }

  restorePlayerHearts(combatState, playerId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    playerStats.hearts = GAME_CONSTANTS.PLAYER_STARTING_HEARTS;
  }

  resetPlayerStats(combatState, playerId) {
    const playerStats = this.getPlayerStats(combatState, playerId);
    Object.assign(playerStats, initializePlayerStats());
  }

  removePlayerStats(combatState, playerId) {
    combatState.playerStats.delete(playerId);
  }
}

export default CombatManager;
