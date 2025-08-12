import { GAME_CONSTANTS } from "../utils/game.constants.js";
import {
  initializePlayerStats,
  initializeTeamStats,
  calculateBossHP,
  calculateDamage,
} from "../utils/game.utils.js";

class CombatManager {
  constructor() {
    this.combatStates = new Map();
  }

  initializeCombat(battleSessionData, numberOfPlayers) {
    const combatState = {
      battleSessionId: battleSessionData.id,
      eventBoss: {
        id: battleSessionData.eventBoss.id,
        name: battleSessionData.eventBoss.name,
        maxHP: calculateBossHP(
          numberOfPlayers,
          battleSessionData.eventBoss.numberOfTeams
        ),
        currentHP: 0,
      },
      playerStats: new Map(),
      teamStats: new Map(),
    };

    combatState.eventBoss.currentHP = combatState.eventBoss.maxHP;

    for (const team of battleSessionData.teams) {
      combatState.teamStats.set(team.id, initializeTeamStats());
    }

    for (const player of battleSessionData.players) {
      combatState.playerStats.set(player.id, initializePlayerStats());
    }

    this.combatStates.set(battleSessionData.id, combatState);
  }

  updateBossHP(battleSessionId, numberOfPlayers, numberOfTeams) {
    const combatState = this.getCombatState(battleSessionId);
    const newMaxHP = calculateBossHP(numberOfPlayers, numberOfTeams);
    if (newMaxHP > combatState.maxHP) {
      combatState.maxHP = newMaxHP;
      combatState.currentHP += newMaxHP - combatState.maxHP;
    }
  }

  processPlayerAttack(
    battleSessionId,
    playerId,
    teamId,
    isCorrect,
    responseTime,
    questionTimeLimit
  ) {
    const playerStats = this.getPlayerStats(battleSessionId, playerId);
    const teamStats = this.getTeamStats(battleSessionId, teamId);
    const damage = calculateDamage(isCorrect, responseTime, questionTimeLimit);

    if (damage > 0) {
      this.applyDamage(battleSessionId, damage);
      playerStats.totalDamage += damage;
      teamStats.totalDamage += damage;
    }

    if (isCorrect) {
      playerStats.correctAnswers += 1;
      teamStats.correctAnswers += 1;
    } else {
      playerStats.incorrectAnswers += 1;
      teamStats.incorrectAnswers += 1;
      this.deductPlayerHearts(battleSessionId, playerId);
    }

    playerStats.questionsAnswered += 1;
    teamStats.questionsAnswered += 1;
  }

  applyDamage(battleSessionId, damage) {
    const combatState = this.getCombatState(battleSessionId);
    combatState.eventBoss.currentHP = Math.max(
      0,
      combatState.eventBoss.currentHP - damage
    );
    return combatState.eventBoss.currentHP;
  }

  deductPlayerHearts(battleSessionId, playerId) {
    const playerStats = this.getPlayerStats(battleSessionId, playerId);
    playerStats.hearts = Math.max(0, playerStats.hearts - 1);
    return playerStats.hearts;
  }

  getCombatState(battleSessionId) {
    if (!this.combatStates.has(battleSessionId)) {
      throw new Error("Combat session not found");
    }
    return this.combatStates.get(battleSessionId);
  }

  getPlayerStats(battleSessionId, playerId) {
    const combatState = this.getCombatState(battleSessionId);
    if (!combatState.playerStats.has(playerId)) {
      throw new Error(`Player with ID ${playerId} not found in combat session`);
    }
    return combatState.playerStats.get(playerId);
  }

  getTeamStats(battleSessionId, teamId) {
    const combatState = this.getCombatState(battleSessionId);
    if (!combatState.teamStats.has(teamId)) {
      throw new Error(`Team with ID ${teamId} not found in combat session`);
    }
    return combatState.teamStats.get(teamId);
  }

  isBossDefeated(battleSessionId) {
    const combatState = this.getCombatState(battleSessionId);
    return combatState.eventBoss.currentHP <= 0;
  }

  getPlayerHearts(battleSessionId, playerId) {
    const playerStats = this.getPlayerStats(battleSessionId, playerId);
    return playerStats.hearts;
  }

  restorePlayerHearts(battleSessionId, playerId) {
    const playerStats = this.getPlayerStats(battleSessionId, playerId);
    playerStats.hearts = GAME_CONSTANTS.PLAYER_STARTING_HEARTS;
  }

  resetPlayerStats(battleSessionId, playerId) {
    const playerStats = this.getPlayerStats(battleSessionId, playerId);
    Object.assign(playerStats, initializePlayerStats());
  }

  resetCombat(battleSessionId) {
    this.combatStates.delete(battleSessionId);
  }
}

export default CombatManager;
