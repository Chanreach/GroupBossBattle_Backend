import fs from "fs";
import path from "path";

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, "server-error.log");

try {
  if (fs.existsSync(logFilePath)) {
    const stats = fs.statSync(logFilePath);
    const lastModified = new Date(stats.mtime).toDateString();
    const today = new Date().toDateString();

    if (lastModified !== today) {
      fs.writeFileSync(logFilePath, "", "utf8");
      console.log("[Logger] Cleared log file from:", lastModified);
    }
  }
} catch (error) {
  console.error("[Logger] Error handling log file:", error);
}

export const logToFile = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage, "utf8");
};

const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError(...args);
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg))
    .join(" ");
  logToFile(`[ERROR] ${message}`);
};
