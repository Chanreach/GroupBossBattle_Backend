import RandomGenerator from "./random-generator.js";
import { generateSeed } from "./generate-seed.js";

const ANIMALS = [
  "Tiger",
  "Lion",
  "Wolf",
  "Eagle",
  "Bear",
  "Shark",
  "Panther",
  "Falcon",
  "Rhino",
  "Cobra",
  "Dragon",
  "Phoenix",
  "Raven",
  "Leopard",
  "Jaguar",
  "Viper",
  "Hawk",
  "Scorpion",
  "Griffin",
  "Lynx",
  "Wolverine",
  "Barracuda",
  "Stallion",
  "Bison",
  "Moose",
  "Kraken",
  "Mantis",
  "Hornet",
  "Piranha",
  "Cheetah",
  "Anaconda",
  "Badger",
  "Hyena",
  "Crocodile",
  "Mammoth",
  "Thunderbird",
  "Basilisk",
  "Wyvern",
  "Cerberus",
  "Chimera",
  "Hydra",
  "Minotaur",
  "Sphinx",
  "Gargoyle",
  "Fenrir",
  "Behemoth",
  "Leviathan",
];

const ADJECTIVES = [
  "Fierce",
  "Mighty",
  "Savage",
  "Bold",
  "Swift",
  "Ruthless",
  "Legendary",
  "Elite",
  "Blazing",
  "Thunder",
  "Steel",
  "Shadow",
  "Crimson",
  "Golden",
  "Iron",
  "Storm",
  "Fire",
  "Ice",
  "Mystic",
  "Dark",
  "Wild",
  "Ancient",
  "Royal",
  "Brave",
  "Valiant",
  "Noble",
  "Deadly",
  "Silent",
  "Raging",
  "Frozen",
  "Burning",
  "Venomous",
  "Armored",
  "Winged",
  "Spectral",
  "Eternal",
  "Divine",
  "Infernal",
  "Celestial",
  "Demonic",
  "Arcane",
];

class TeamNameGenerator {
  static generateTeamName(existingNames = [], options = {}) {
    const {
      useAdjective = true,
      seed = null,
      maxAttempts = 100,
      usedAnimals = new Set(),
      adjectiveUsage = {},
    } = options;

    const availableAnimals = ANIMALS.filter(
      (animal) => !usedAnimals.has(animal.toLowerCase())
    );
    const availableAdjectives = ADJECTIVES.filter(
      (adj) => (adjectiveUsage[adj] || 0) < 1
    );

    const randomGenerator = seed
      ? new RandomGenerator(seed)
      : new RandomGenerator();
    let attempts = 0;
    while (attempts < maxAttempts) {
      let teamName, animal, adjective;

      animal = randomGenerator.randomChoice(
        availableAnimals.length > 0 ? availableAnimals : ANIMALS
      );

      if (useAdjective) {
        adjective = randomGenerator.randomChoice(
          availableAdjectives.length > 0 ? availableAdjectives : ADJECTIVES
        );
        teamName = `${adjective} ${animal}`;
      } else {
        teamName = animal;
      }

      const isNameTaken = existingNames.some(
        (name) => name.toLowerCase() === teamName.toLowerCase()
      );

      if (!isNameTaken) {
        usedAnimals.add(animal.toLowerCase());
        if (useAdjective) {
          adjectiveUsage[adjective] = (adjectiveUsage[adjective] || 0) + 1;
        }
        return teamName;
      }

      attempts++;
    }

    const animal = randomGenerator.randomChoice(ANIMALS);
    usedAnimals.add(animal.toLowerCase());
    const timestamp = Date.now().toString().slice(-3);
    if (useAdjective) {
      const adjective = randomGenerator.randomChoice(ADJECTIVES);
      adjectiveUsage[adjective] = (adjectiveUsage[adjective] || 0) + 1;
      return `${adjective} ${animal} ${timestamp}`;
    } else {
      return `${animal} ${timestamp}`;
    }
  }

  static generateUniqueTeamNames(numberOfTeams, fields = []) {
    const seed = generateSeed(fields);
    const teamNames = [];
    const usedAnimals = new Set();
    const adjectiveUsage = {};

    for (let i = 0; i < numberOfTeams; i++) {
      const newName = this.generateTeamName(teamNames, {
        seed: seed, // Offset seed for variety
        usedAnimals,
        adjectiveUsage,
      });
      teamNames.push(newName);
    }

    return teamNames;
  }

  static getAvailableAnimals() {
    return [...ANIMALS];
  }

  static getAvailableAdjectives() {
    return [...ADJECTIVES];
  }
}

export default TeamNameGenerator;
