export const updateEventStatus = (event) => {
  const now = new Date();
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);

  if (now < startTime) {
    return "upcoming";
  } else if (now >= startTime && now <= endTime) {
    return "ongoing";
  } else {
    return "completed";
  }
};
