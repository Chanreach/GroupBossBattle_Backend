import teamManager from "../managers/team.manager.js";
import questionManager from "../managers/question.manager.js";
import BossService from "../services/boss.service.js";

class BattleSessionManager {
  constructor() {
    this.teamManager = teamManager;
    this.questionManager = questionManager;
    this.eventBoss = null;
  }

  async initializeBattleSession(eventBossId) {
    try {
      this.eventBoss = await BossService.getBossByEventBossId(eventBossId);
      if (!this.eventBoss) {
        throw new Error("Event boss not found");
      }
      await this.questionManager.initializeQuestionBank(eventBossId);
      this.teamManager.initializeTeams(this.eventBoss.numberOfTeams);
      this.questionManager.prepareQuestionPoolForPlayer(
        this.eventBoss.id,
        this.eventBoss.creatorId
      );
      console.log("Battle session initialized successfully.");
    }
    catch (error) {

      console.error("Error initializing battle session:", error);
      throw error;
    }
  }

  createBattleSession(eventBossId) {}
}

const battleSessionManager = new BattleSessionManager();
export default battleSessionManager;
