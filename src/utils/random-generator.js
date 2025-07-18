class RandomGenerator {
  constructor(seed = Date.now()) {
    this._a = seed >>> 0;
    this._initialSeed = this._a;
  }

  next() {
    this._a += 0x6D2B79F5;
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

  randomInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  randomFloat(min = 0, max = 1) {
    return this.next() * (max - min) + min;
  }

  randomBool(probability = 0.5) {
    return this.next() < probability;
  }

  randomChoice(array) {
    if (!Array.isArray(array) || array.length === 0) return undefined;
    return array[this.randomInt(0, array.length - 1)];
  }

  shuffle(array) {
    if (!Array.isArray(array) || array.length === 0) return [];
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}

export default RandomGenerator;
