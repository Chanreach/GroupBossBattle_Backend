import { User } from "../models/index.js";

const handleGuestActivity = (io, socket) => {
  const { guestId } = socket.handshake.auth || {};

  if (guestId) {
    User.update({ lastActiveAt: new Date() }, { where: { id: guestId } }).catch(
      (err) => console.error("Failed to update lastActiveAt:", err)
    );
  }

  console.log(`Socket connected for guest user ID: ${guestId}`);

  socket.on("heartbeat", async () => {
    if (guestId) {
      try {
        await User.update(
          { lastActiveAt: new Date() },
          { where: { id: guestId } }
        );
        console.log(
          `Heartbeat received. Updated lastActiveAt for guest ID: ${guestId}`
        );
      } catch (err) {
        console.error("Failed to update lastActiveAt on heartbeat:", err);
      }
    }
  });
};

export default handleGuestActivity;
