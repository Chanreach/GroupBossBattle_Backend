import validator from "validator";

export const normalizeName = (name) => {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/<[^>]*>/g, "");
};

export const normalizeEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  return validator.normalizeEmail(email, { all_lowercase: true });
};

export const normalizeText = (text) => {
  if (!text || typeof text !== "string") return "";
  return text.trim().replace(/\s+/g, " ");
};

export const normalizeInteger = (value) => {
  const intValue = parseInt(value, 10);
  return isNaN(intValue) ? null : intValue;
}

export const updateEventStatus = (event) => {
  const now = new Date();
  const startAt = new Date(event.startAt);
  const endAt = new Date(event.endAt);

  if (now < startAt) return "upcoming";
  else if (now < endAt) return "ongoing";
  return "completed";
};
