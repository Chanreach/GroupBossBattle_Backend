import battleSessionManager from "../../managers/battle-session.manager.js";
import EventBossService from "../../services/event-boss.service.js";
import { SOCKET_EVENTS } from "../../utils/socket.constants.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleEventBoss = (io, socket) => {
  socket.on(SOCKET_EVENTS.BOSS.REQUEST, async (payload) => {
    const { eventBossId, joinCode } = payload;
    if (!eventBossId || !joinCode) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or joinCode.",
      });
      return;
    }

    try {
      const eventBoss = await EventBossService.getEventBossByIdAndJoinCode(
        eventBossId,
        joinCode
      );
      if (!eventBoss) {
        socket.emit(SOCKET_EVENTS.BOSS.NOT_FOUND, {
          message: "Event boss not found.",
        });
        return;
      }

      const battleSession = battleSessionManager.findBattleSession(eventBossId);
      if (
        !battleSession &&
        eventBoss.status !== GAME_CONSTANTS.BOSS_STATUS.PENDING
      ) {
        const updatedEventBoss = await EventBossService.updateEventBossStatus(
          eventBossId,
          GAME_CONSTANTS.BOSS_STATUS.ACTIVE
        );
        if (!updatedEventBoss) {
          console.error(
            "[EventBossHandler] Failed to update event boss status."
          );
        }

        eventBoss.status = updatedEventBoss?.status;
      }

      socket.emit(SOCKET_EVENTS.BOSS.RESPONSE, {
        message: "Successfully retrieved event boss.",
        data: { eventBoss },
      });

      const event = eventBoss.event;
      if (event?.status !== GAME_CONSTANTS.EVENT_STATUS.ONGOING) {
        const reason =
          event?.status === GAME_CONSTANTS.EVENT_STATUS.COMPLETED
            ? "The event has ended. \nThank you for participating."
            : "You cannot join the battle right now. \nThe event is not currently ongoing.";
        socket.emit(SOCKET_EVENTS.JOIN_RESTRICTION.RESPONSE, {
          data: {
            isJoinable: false,
            reason,
          },
        });
        return;
      }

      const questions = eventBoss.categories.flatMap((c) => c.questions);
      if (questions.length < 10) {
        socket.emit(SOCKET_EVENTS.JOIN_RESTRICTION.RESPONSE, {
          data: {
            isJoinable: false,
            reason: "Not enough questions are available for this event boss.",
          },
        });
        return;
      }

      const answerChoices = questions.every(
        (question) =>
          question.answerChoices && question.answerChoices.length === 8
      );
      if (!answerChoices) {
        socket.emit(SOCKET_EVENTS.JOIN_RESTRICTION.RESPONSE, {
          data: {
            isJoinable: false,
            reason: "Not all questions have sufficient answer choices.",
          },
        });
        return;
      }
    } catch (error) {
      console.error("[EventBossHandler] Error retrieving event boss:", error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while retrieving event boss.",
      });
    }
  });
};

export default handleEventBoss;
