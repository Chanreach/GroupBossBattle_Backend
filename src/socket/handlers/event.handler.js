import eventBus from "../../utils/event-bus.util.js";
import { SOCKET_EVENTS, SOCKET_ROOMS } from "../../utils/socket.constants.js";

const handleEvent = (io, socket) => {
  eventBus.on(SOCKET_EVENTS.EVENT.ENDED, (payload) => {
    const { eventBossId, podiumEndAt } = payload;

    io.to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId)).emit(
      SOCKET_EVENTS.EVENT.ENDED,
      {
        message: "The event has ended. Thank you for participating!",
        data: { podiumEndAt },
      }
    );

    io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
      SOCKET_EVENTS.EVENT.ENDED,
      {
        message: "The event has ended. Thank you for participating!",
      }
    );
  });
};

export default handleEvent;
