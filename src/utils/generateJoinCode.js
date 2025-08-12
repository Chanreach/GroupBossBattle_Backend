import crypto from "crypto";
import { EventBoss } from "../models/index.js";

function generateJoinCode(length = 6) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    result += characters[randomIndex];
  }
  
  return result;
}

export async function generateUniqueJoinCode(length = 6, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const joinCode = generateJoinCode(length);
    
    try {
      // Check if this join code already exists
      const existingEventBoss = await EventBoss.findOne({
        where: { joinCode },
      });
      
      if (!existingEventBoss) {
        return joinCode;
      }
    } catch (error) {
      // If there's a database error, continue trying
      console.warn(`Database error while checking join code uniqueness: ${error.message}`);
    }
  }
  
  throw new Error(`Unable to generate unique join code after ${maxAttempts} attempts`);
}

export function validateJoinCode(joinCode) {
  if (!joinCode || typeof joinCode !== "string") {
    return false;
  }
  
  // Check if it's 4-8 characters long and contains only uppercase letters and numbers
  const joinCodeRegex = /^[A-Z0-9]{4,8}$/;
  return joinCodeRegex.test(joinCode);
}

export default { generateUniqueJoinCode, validateJoinCode };
