# Socket.IO Events Documentation

This document describes all the Socket.IO events used in the Group Boss Battle game.

## Client to Server Events

### Matchmaking Events

#### `join-boss-preview`

Joins the boss preview page when a player scans the QR code.

```javascript
socket.emit("join-boss-preview", {
  eventBossId: "string", // ID of the boss event
  playerData: {
    nickname: "string", // Player's chosen nickname
  },
});
```

#### `join-boss-fight`

Confirms the player wants to join the active battle.

```javascript
socket.emit("join-boss-fight", {
  eventBossId: "string",
});
```

#### `leave-boss-session`

Leaves the current boss session.

```javascript
socket.emit("leave-boss-session");
```

### Combat Events

#### `request-question`

Requests a new question to answer.

```javascript
socket.emit("request-question", {
  eventBossId: "string",
});
```

#### `submit-answer`

Submits an answer to a question.

```javascript
socket.emit("submit-answer", {
  eventBossId: "string",
  questionId: "string/number",
  choiceIndex: "number", // 0-3
  responseTime: "number", // Time taken in milliseconds
});
```

#### `get-battle-status`

Gets the current battle status.

```javascript
socket.emit("get-battle-status", {
  eventBossId: "string",
});
```

### Knockout & Revival Events

#### `revive-teammate`

Attempts to revive a knocked-out teammate.

```javascript
socket.emit("revive-teammate", {
  eventBossId: "string",
  reviveCode: "string", // The revival code from knocked-out player
});
```

#### `get-knockout-status`

Gets current knockout status and team information.

```javascript
socket.emit("get-knockout-status", {
  eventBossId: "string",
});
```

#### `check-revival-requests`

Checks if there are any teammates needing revival.

```javascript
socket.emit("check-revival-requests", {
  eventBossId: "string",
});
```

#### `revival-timeout`

Notifies that the revival window has expired.

```javascript
socket.emit("revival-timeout", {
  eventBossId: "string",
});
```

### Host/Admin Events

#### `host-start-boss-fight`

Manually starts a boss fight (host only).

```javascript
socket.emit("host-start-boss-fight", {
  eventBossId: "string",
  hostId: "string",
});
```

#### `host-stop-boss-fight`

Manually stops a boss fight (host only).

```javascript
socket.emit("host-stop-boss-fight", {
  eventBossId: "string",
  hostId: "string",
});
```

#### `get-boss-session-info`

Gets detailed session information (host/admin only).

```javascript
socket.emit("get-boss-session-info", {
  eventBossId: "string",
});
```

#### `update-boss-parameters`

Updates boss parameters (host/admin only).

```javascript
socket.emit("update-boss-parameters", {
  eventBossId: "string",
  parameters: {
    cooldownDuration: "number", // in milliseconds
    teamCount: "number",
    maxHp: "number",
  },
});
```

#### `get-all-boss-sessions`

Gets all active boss sessions (admin only).

```javascript
socket.emit("get-all-boss-sessions");
```

#### `reset-boss-session`

Resets a boss session (host/admin only).

```javascript
socket.emit("reset-boss-session", {
  eventBossId: "string",
});
```

### Utility Events

#### `ping`

Health check ping.

```javascript
socket.emit("ping");
```

#### `get-connection-info`

Gets connection information.

```javascript
socket.emit("get-connection-info");
```

## Server to Client Events

### Matchmaking Responses

#### `boss-preview-joined`

Confirms successful join to boss preview.

```javascript
{
  session: {
    eventBossId: 'string',
    bossData: {
      id: 'string',
      name: 'string',
      currentHp: 'number',
      maxHp: 'number',
      isActive: 'boolean',
      cooldownUntil: 'Date|null'
    },
    playerCount: 'number',
    isStarted: 'boolean',
    canStart: 'boolean'
  },
  player: {
    id: 'string',
    nickname: 'string',
    hearts: 'number',
    // ... other player properties
  }
}
```

#### `player-count-updated`

Notifies about updated player count.

```javascript
{
  playerCount: 'number',
  canStart: 'boolean'
}
```

#### `joined-boss-fight`

Confirms readiness to fight.

```javascript
{
  message: 'string',
  session: {
    eventBossId: 'string',
    bossData: { /* boss data */ },
    playerCount: 'number'
  }
}
```

#### `battle-started`

Notifies that the battle has started.

```javascript
{
  session: {
    eventBossId: 'string',
    bossData: { /* boss data */ },
    teams: [
      {
        id: 'number',
        name: 'string',
        playerCount: 'number',
        totalDamage: 'number'
      }
    ],
    players: [
      {
        id: 'string',
        nickname: 'string',
        teamId: 'number',
        hearts: 'number',
        status: 'string'
      }
    ]
  }
}
```

### Combat Responses

#### `question-received`

Receives a new question to answer.

```javascript
{
  question: {
    id: 'string/number',
    text: 'string',
    choices: ['string', 'string', 'string', 'string'], // 4 choices
    timeLimit: 'number' // in milliseconds
  }
}
```

#### `answer-result`

Result of submitted answer.

```javascript
{
  isCorrect: 'boolean',
  damage: 'number', // if correct
  timeTaken: 'number',
  message: 'string',
  correctIndex: 'number' // if incorrect
}
```

#### `player-attacked`

Notifies about a successful attack.

```javascript
{
  playerNickname: 'string',
  teamId: 'number',
  damage: 'number',
  bossCurrentHp: 'number',
  bossMaxHp: 'number'
}
```

#### `player-lost-heart`

Notifies about a player losing a heart.

```javascript
{
  playerNickname: 'string',
  teamId: 'number',
  hearts: 'number',
  isKnockedOut: 'boolean'
}
```

#### `boss-defeated`

Notifies that the boss has been defeated.

```javascript
{
  message: 'string',
  winningTeam: {
    id: 'number',
    name: 'string',
    totalDamage: 'number'
  },
  finalHitBy: 'string', // player ID
  cooldownUntil: 'Date',
  nextBattleIn: 'number' // seconds
}
```

### Knockout & Revival Responses

#### `player-knocked-out`

Notifies player they are knocked out.

```javascript
{
  message: 'string',
  reviveCode: 'string',
  expiresIn: 'number' // milliseconds
}
```

#### `teammate-knocked-out`

Notifies about a teammate being knocked out.

```javascript
{
  knockedOutPlayer: 'string',
  message: 'string'
}
```

#### `player-revived`

Notifies player they have been revived.

```javascript
{
  message: 'string',
  hearts: 'number',
  revivedBy: 'string'
}
```

#### `revive-successful`

Confirms successful revival.

```javascript
{
  message: 'string',
  revivedPlayer: 'string'
}
```

#### `revive-failed`

Notifies about failed revival attempt.

```javascript
{
  message: "string";
}
```

### General Events

#### `error`

General error message.

```javascript
{
  message: "string";
}
```

#### `boss-on-cooldown`

Notifies that boss is on cooldown.

```javascript
{
  message: 'string',
  remainingTime: 'number' // seconds
}
```

#### `pong`

Response to ping.

```javascript
// No payload
```

#### `connection-info`

Connection information.

```javascript
{
  socketId: 'string',
  connectedAt: 'string' // ISO date string
}
```

## Socket Rooms

The system uses Socket.IO rooms to manage communication:

- `boss-{eventBossId}`: All players in a specific boss session join this room
- Players are automatically added/removed from rooms when joining/leaving sessions

## Error Handling

All handlers include try-catch blocks and emit `error` events with descriptive messages when something goes wrong. Common error scenarios:

- Invalid or missing data
- Player not found in session
- Session not found
- Battle not active when required
- Permission denied for host/admin actions

## Connection Management

- Players are automatically cleaned up when they disconnect
- Session data persists until all players leave
- Automatic scaling of boss HP based on player count
- Cooldown management between battles
