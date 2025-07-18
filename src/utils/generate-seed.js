import crypto from "crypto";

const generateSeed = (fields = []) => {
  const input = fields.join("_");
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return parseInt(hash.substring(0, 8), 16);
};

export { generateSeed };
