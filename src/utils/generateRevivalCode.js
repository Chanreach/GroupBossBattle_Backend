/**
 * Generate Revival Code Utility
 *
 * Generates unique revival codes for knocked-out players
 * These codes can be used by other players to revive teammates
 */

import RandomGenerator from "./random-generator.js";
import { createRevivalCodeSeed } from "./game.constants.js";

/**
 * Generate a seeded revival code
 * @param {string} bossSessionId - The boss session ID for seeding
 * @param {number} eventBossId - The event boss ID for seeding
 * @param {string} roomCode - The room code for seeding
 * @param {string} joinCode - The join code for seeding
 * @param {number} numberOfTeams - Number of teams for seeding
 * @param {number} numberOfPlayers - Number of players for seeding
 * @param {string} playerId - The player ID requesting revival
 * @param {number} length - Length of the code (default: 6)
 * @returns {string} - Generated revival code
 */
export function generateRevivalCode(
  bossSessionId,
  eventBossId,
  roomCode,
  joinCode,
  numberOfTeams,
  numberOfPlayers,
  playerId,
  length = 6
) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  // Create unique seed for this revival code
  const seed = createRevivalCodeSeed(
    bossSessionId,
    eventBossId,
    roomCode,
    joinCode,
    numberOfTeams,
    numberOfPlayers,
    playerId
  );

  const generator = new RandomGenerator(seed);
  let result = "";

  for (let i = 0; i < length; i++) {
    result += characters.charAt(generator.getRandomInt(0, characters.length - 1));
  }

  return result;
}

/**
 * Generate a unique seeded revival code (ensures uniqueness against existing codes)
 * @param {string} bossSessionId - The boss session ID for seeding
 * @param {number} eventBossId - The event boss ID for seeding
 * @param {string} roomCode - The room code for seeding
 * @param {string} joinCode - The join code for seeding
 * @param {number} numberOfTeams - Number of teams for seeding
 * @param {number} numberOfPlayers - Number of players for seeding
 * @param {string} playerId - The player ID requesting revival
 * @param {Set|Array} existingCodes - Set or array of existing codes to avoid duplicates
 * @param {number} length - Length of the code (default: 6)
 * @param {number} maxAttempts - Maximum attempts to generate unique code (default: 100)
 * @returns {string} - Generated unique revival code
 */
export function generateUniqueRevivalCode(
  bossSessionId,
  eventBossId,
  roomCode,
  joinCode,
  numberOfTeams,
  numberOfPlayers,
  playerId,
  existingCodes = new Set(),
  length = 6,
  maxAttempts = 100
) {
  const existingSet =
    existingCodes instanceof Set ? existingCodes : new Set(existingCodes);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Include attempt number in the playerId for unique seeding
    const attemptPlayerId = `${playerId}_attempt${attempt}`;
    const code = generateRevivalCode(
      bossSessionId,
      eventBossId,
      roomCode,
      joinCode,
      numberOfTeams,
      numberOfPlayers,
      attemptPlayerId,
      length
    );
    if (!existingSet.has(code)) {
      return code;
    }
  }

  // If we can't generate a unique code after maxAttempts,
  // increase length and try once more
  const longerAttemptPlayerId = `${playerId}_longer`;
  const longerCode = generateRevivalCode(
    bossSessionId,
    eventBossId,
    roomCode,
    joinCode,
    numberOfTeams,
    numberOfPlayers,
    longerAttemptPlayerId,
    length + 1
  );
  if (!existingSet.has(longerCode)) {
    return longerCode;
  }

  // Fallback: return a code with timestamp suffix
  return generateRevivalCode(length - 3) + Date.now().toString().slice(-3);
}

/**
 * Generate a more secure revival code with mixed case
 * @param {number} length - Length of the code (default: 8)
 * @returns {string} - Generated secure revival code
 */
export function generateSecureRevivalCode(length = 8) {
  const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowerCase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const allCharacters = upperCase + lowerCase + numbers;

  let result = "";

  // Ensure at least one character from each set
  result += upperCase.charAt(Math.floor(Math.random() * upperCase.length));
  result += lowerCase.charAt(Math.floor(Math.random() * lowerCase.length));
  result += numbers.charAt(Math.floor(Math.random() * numbers.length));

  // Fill the rest with random characters
  for (let i = 3; i < length; i++) {
    result += allCharacters.charAt(
      Math.floor(Math.random() * allCharacters.length)
    );
  }

  // Shuffle the result to randomize positions
  return result
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Generate a pronounceable revival code (easier to communicate verbally)
 * @returns {string} - Generated pronounceable revival code
 */
export function generatePronounceableRevivalCode() {
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ";
  const vowels = "AEIOU";
  const numbers = "0123456789";

  let result = "";

  // Pattern: consonant-vowel-consonant-number-consonant-vowel
  result += consonants.charAt(Math.floor(Math.random() * consonants.length));
  result += vowels.charAt(Math.floor(Math.random() * vowels.length));
  result += consonants.charAt(Math.floor(Math.random() * consonants.length));
  result += numbers.charAt(Math.floor(Math.random() * numbers.length));
  result += consonants.charAt(Math.floor(Math.random() * consonants.length));
  result += vowels.charAt(Math.floor(Math.random() * vowels.length));

  return result;
}

/**
 * Validate a revival code format
 * @param {string} code - Code to validate
 * @returns {boolean} - Whether the code is valid format
 */
export function validateRevivalCodeFormat(code) {
  if (!code || typeof code !== "string") {
    return false;
  }

  // Check if code is alphanumeric and appropriate length
  const alphanumericRegex = /^[A-Z0-9]{4,10}$/i;
  return alphanumericRegex.test(code);
}

/**
 * Validate a revival code (alias for validateRevivalCodeFormat)
 * @param {string} code - Code to validate
 * @returns {boolean} - Whether the code is valid format
 */
export function validateRevivalCode(code) {
  return validateRevivalCodeFormat(code);
}

/**
 * Generate a time-limited revival code with expiration
 * @param {number} length - Length of the code
 * @param {number} expirationMinutes - Minutes until expiration
 * @returns {object} - Object with code and expiration timestamp
 */
export function generateTimeLimitedRevivalCode(
  length = 6,
  expirationMinutes = 10
) {
  const code = generateRevivalCode(length);
  const expirationTime = Date.now() + expirationMinutes * 60 * 1000;

  return {
    code,
    expirationTime,
    isValid: function () {
      return Date.now() < this.expirationTime;
    },
  };
}

/**
 * Generate revival codes for multiple players
 * @param {number} count - Number of codes to generate
 * @param {number} length - Length of each code
 * @returns {string[]} - Array of unique revival codes
 */
export function generateMultipleRevivalCodes(count, length = 6) {
  const codes = new Set();

  while (codes.size < count) {
    codes.add(generateRevivalCode(length));
  }

  return Array.from(codes);
}

/**
 * Format revival code for display (add separators for readability)
 * @param {string} code - Raw revival code
 * @param {string} separator - Separator character (default: '-')
 * @returns {string} - Formatted revival code
 */
export function formatRevivalCodeForDisplay(code, separator = "-") {
  if (!code || typeof code !== "string") {
    return "";
  }

  // Split code into groups of 2-3 characters for better readability
  const groups = [];
  for (let i = 0; i < code.length; i += 3) {
    groups.push(code.substring(i, i + 3));
  }

  return groups.join(separator);
}

// Default export
export default {
  generateRevivalCode,
  generateUniqueRevivalCode,
  generateSecureRevivalCode,
  generatePronounceableRevivalCode,
  validateRevivalCodeFormat,
  validateRevivalCode,
  generateTimeLimitedRevivalCode,
  generateMultipleRevivalCodes,
  formatRevivalCodeForDisplay,
};
