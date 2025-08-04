import RandomGenerator from "./random-generator.js";

const randomGenerator = new RandomGenerator();
const generateGuestName = () => {
  const randomId = randomGenerator.getRandomInt(0, 9999).toString().padStart(4, '0');
  return `guest_${randomId}`;
};

export default generateGuestName;
