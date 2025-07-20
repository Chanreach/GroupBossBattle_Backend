// Simple Socket.IO client test script
// Run this with: node test-socket-client.js

import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";

class SocketTestClient {
  constructor(nickname) {
    this.nickname = nickname;
    this.socket = null;
    this.eventBossId = "test-boss-1";
  }

  connect() {
    this.socket = io(SERVER_URL);

    // Connection events
    this.socket.on("connect", () => {
      console.log(`[${this.nickname}] Connected with ID: ${this.socket.id}`);
      this.setupListeners();

      // Auto-join boss preview after connection
      setTimeout(() => this.joinBossPreview(), 1000);
    });

    this.socket.on("disconnect", () => {
      console.log(`[${this.nickname}] Disconnected`);
    });

    this.socket.on("error", (data) => {
      console.log(`[${this.nickname}] Error:`, data.message);
    });
  }

  setupListeners() {
    // Boss preview events
    this.socket.on("boss-preview-joined", (data) => {
      console.log(`[${this.nickname}] Joined boss preview:`, data);

      // Auto-join fight after 2 seconds
      setTimeout(() => this.joinBossFight(), 2000);
    });

    this.socket.on("player-count-updated", (data) => {
      console.log(`[${this.nickname}] Player count updated:`, data);
    });

    this.socket.on("battle-started", (data) => {
      console.log(`[${this.nickname}] Battle started!`, data);

      // Start requesting questions
      setTimeout(() => this.requestQuestion(), 1000);
    });

    // Combat events
    this.socket.on("question-received", (data) => {
      console.log(`[${this.nickname}] Question received:`, data.question.text);
      console.log(`[${this.nickname}] Choices:`, data.question.choices);

      // Auto-answer with a random choice after 1-3 seconds
      const delay = Math.random() * 2000 + 1000;
      setTimeout(() => {
        const randomChoice = Math.floor(Math.random() * 4);
        this.submitAnswer(data.question.id, randomChoice, delay);
      }, delay);
    });

    this.socket.on("answer-result", (data) => {
      if (data.isCorrect) {
        console.log(`[${this.nickname}] ✅ Correct! Damage: ${data.damage}`);
        // Request next question after a short delay
        setTimeout(() => this.requestQuestion(), 2000);
      } else {
        console.log(
          `[${this.nickname}] ❌ Incorrect! Hearts remaining: ${
            this.hearts || "unknown"
          }`
        );
        // Still request next question (if not knocked out)
        setTimeout(() => this.requestQuestion(), 2000);
      }
    });

    this.socket.on("player-attacked", (data) => {
      console.log(
        `[${this.nickname}] 🗡️ ${data.playerNickname} attacked for ${data.damage} damage! Boss HP: ${data.bossCurrentHp}/${data.bossMaxHp}`
      );
    });

    this.socket.on("player-lost-heart", (data) => {
      console.log(
        `[${this.nickname}] 💔 ${data.playerNickname} lost a heart! Hearts: ${data.hearts}`
      );
      if (data.isKnockedOut) {
        console.log(
          `[${this.nickname}] 💀 ${data.playerNickname} was knocked out!`
        );
      }
    });

    this.socket.on("boss-defeated", (data) => {
      console.log(
        `[${this.nickname}] 🏆 Boss defeated! Winner: ${
          data.winningTeam?.name || "None"
        }`
      );
      console.log(
        `[${this.nickname}] Next battle in: ${data.nextBattleIn} seconds`
      );
    });

    // Knockout events
    this.socket.on("player-knocked-out", (data) => {
      console.log(
        `[${this.nickname}] 💀 I was knocked out! Revival code: ${data.reviveCode}`
      );
    });

    this.socket.on("teammate-knocked-out", (data) => {
      console.log(
        `[${this.nickname}] 🆘 Teammate ${data.knockedOutPlayer} needs revival!`
      );
    });
  }

  joinBossPreview() {
    console.log(`[${this.nickname}] Joining boss preview...`);
    this.socket.emit("join-boss-preview", {
      eventBossId: this.eventBossId,
      playerData: {
        nickname: this.nickname,
      },
    });
  }

  joinBossFight() {
    console.log(`[${this.nickname}] Joining boss fight...`);
    this.socket.emit("join-boss-fight", {
      eventBossId: this.eventBossId,
    });
  }

  requestQuestion() {
    this.socket.emit("request-question", {
      eventBossId: this.eventBossId,
    });
  }

  submitAnswer(questionId, choiceIndex, responseTime) {
    console.log(`[${this.nickname}] Submitting answer: choice ${choiceIndex}`);
    this.socket.emit("submit-answer", {
      eventBossId: this.eventBossId,
      questionId,
      choiceIndex,
      responseTime,
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Create test clients
const clients = [
  new SocketTestClient("Alice"),
  new SocketTestClient("Bob"),
  new SocketTestClient("Charlie"),
];

// Connect all clients
clients.forEach((client, index) => {
  setTimeout(() => {
    client.connect();
  }, index * 2000); // Stagger connections
});

// Disconnect all after 60 seconds
setTimeout(() => {
  console.log("Disconnecting all test clients...");
  clients.forEach((client) => client.disconnect());
  process.exit(0);
}, 60000);
