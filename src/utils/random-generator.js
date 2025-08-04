class RandomGenerator {
  constructor(seed = Date.now()) {
    this._a = seed >>> 0;
    this._initialSeed = this._a;
  }

  next() {
    this._a += 0x6d2b79f5;
    let t = this._a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  getState() {
    return this._a;
  }

  setState(state) {
    this._a = state >>> 0;
  }

  reset() {
    this._a = this._initialSeed;
  }

  getRandomInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  getRandomFloat(min = 0, max = 1) {
    return this.next() * (max - min) + min;
  }

  getRandomBool(probability = 0.5) {
    return this.next() < probability;
  }

  getRandomElement(array) {
    if (!Array.isArray(array) || array.length === 0) return undefined;
    return array[this.getRandomInt(0, array.length - 1)];
  }

  getRandomElements(array, count) {
    if (!Array.isArray(array) || array.length === 0 || count <= 0) return [];
    if (count >= array.length) return [...array];
    const result = [];
    const copy = [...array];
    for (let i = 0; i < count && copy.length > 0; i++) {
      const index = this.getRandomInt(0, copy.length - 1);
      result.push(copy[index]);
      copy.splice(index, 1);
    }
    return result;
  }

  shuffleArray(array) {
    if (!Array.isArray(array) || array.length === 0) return [];
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.getRandomInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

export default RandomGenerator;
