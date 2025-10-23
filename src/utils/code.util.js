import crypto from "crypto";

export const generateJoinCode = (length = 6) => {
  const characters = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let result = "";
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    result += characters[randomIndex];
  }
  
  return result;
};
