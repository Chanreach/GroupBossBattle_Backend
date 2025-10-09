import fs from "fs";
import path from "path";

const logsDir = path.join(process.cwd(), "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFilePath = path.join(logsDir, "server.log");

export const logToFile = (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFilePath, logMessage, "utf8");
};

const originalConsoleLog = console.log;
console.log = (...args) => {
  originalConsoleLog(...args);

  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg))
    .join(" ");

  logToFile(message);
};

const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError(...args);
  const message = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : arg))
    .join(" ");
  logToFile(`[ERROR] ${message}`);
};
