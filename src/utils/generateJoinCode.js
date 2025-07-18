import crypto from "crypto";
import { EventBoss } from "../models/index.js";

/**
 * Generates a random join code using uppercase letters and numbers
 * @param {number} length - The length of the join code (default: 6)
 * @returns {string} A random join code
 */
function generateJoinCode(length = 6) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, characters.length);
    result += characters[randomIndex];
  }
  
  return result;
}

/**
 * Generates a unique join code that doesn't exist in the database
 * @param {number} length - The length of the join code (default: 6)
 * @param {number} maxAttempts - Maximum attempts to generate a unique code (default: 10)
 * @returns {Promise<string>} A unique join code
 * @throws {Error} If unable to generate a unique code after maxAttempts
 */
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

/**
 * Validates if a join code has the correct format
 * @param {string} joinCode - The join code to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateJoinCode(joinCode) {
  if (!joinCode || typeof joinCode !== "string") {
    return false;
  }
  
  // Check if it's 4-8 characters long and contains only uppercase letters and numbers
  const joinCodeRegex = /^[A-Z0-9]{4,8}$/;
  return joinCodeRegex.test(joinCode);
}

export default { generateUniqueJoinCode, validateJoinCode };
