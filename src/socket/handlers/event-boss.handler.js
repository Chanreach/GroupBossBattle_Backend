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

      socket.emit(SOCKET_EVENTS.BOSS.RESPONSE, {
        message: "Successfully retrieved event boss.",
        data: { eventBoss },
      });

      const event = eventBoss.event;
      if (event?.status !== GAME_CONSTANTS.EVENT_STATUS.ONGOING) {
        socket.emit(SOCKET_EVENTS.JOIN_RESTRICTION.RESPONSE, {
          data: {
            isJoinable: false,
            reason: "Event is not currently ongoing.",
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
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message || "Internal Server Error.",
      });
    }
  });
};

export default handleEventBoss;
