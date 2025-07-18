import { GAME_CONSTANTS } from "../utils/constants.js";

export class DamageCalculator {
  /**
   * Calculate damage based on response time
   */
  static calculateDamage(responseTime) {
    const { FAST, SLOW } = GAME_CONSTANTS.RESPONSE_TIME_THRESHOLDS;
    const {
      FAST: FAST_MULT,
      NORMAL: NORMAL_MULT,
      SLOW: SLOW_MULT,
    } = GAME_CONSTANTS.DAMAGE_MULTIPLIERS;

    if (responseTime <= FAST) {
      return FAST_MULT;
    } else if (responseTime <= SLOW) {
      return NORMAL_MULT;
    } else {
      return SLOW_MULT;
    }
  }

  /**
   * Apply damage to boss and update session
   */
  static applyDamage(session, playerSession, damage) {
    // Update boss HP
    session.currentHP = Math.max(0, session.currentHP - damage);
    session.totalDamage += damage;

    // Update player damage
    playerSession.totalDamage += damage;

    // Update team damage
    const teamDamage = session.teamDamage.get(playerSession.teamId) || 0;
    session.teamDamage.set(playerSession.teamId, teamDamage + damage);

    // Update team object
    const team = session.teams.get(playerSession.teamId);
    if (team) {
      team.totalDamage += damage;
    }

    return {
      bossHP: session.currentHP,
      teamDamage: team?.totalDamage || 0,
      playerDamage: playerSession.totalDamage,
      totalDamage: session.totalDamage,
    };
  }

  /**
   * Check if boss is defeated
   */
  static isBossDefeated(session) {
    return session.currentHP <= 0;
  }

  /**
   * Scale boss HP based on number of players
   */
  static scaleBossHP(session, playerCount) {
    const { MINIMUM_HP_THRESHOLD, HP_SCALING_FACTOR } = GAME_CONSTANTS;

    // Scale HP: minimum threshold + additional HP per player
    const scaledHP = Math.max(
      MINIMUM_HP_THRESHOLD,
      MINIMUM_HP_THRESHOLD + playerCount * HP_SCALING_FACTOR
    );

    // Only increase HP, never decrease during active fight
    if (scaledHP > session.maxHP) {
      const hpIncrease = scaledHP - session.maxHP;
      session.maxHP = scaledHP;
      session.currentHP += hpIncrease;
      return hpIncrease;
    }

    return 0;
  }
}
