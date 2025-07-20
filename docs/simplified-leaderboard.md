# Simplified Leaderboard System

## Overview

The leaderboard system has been simplified to focus on the core metrics that matter most: **total damage** and **total correct answers**.

## Database Schema

### Leaderboard Model

```javascript
{
  id: UUID (Primary Key),
  playerId: UUID (Player identifier),
  eventId: UUID (Event identifier),
  eventBossId: UUID (Boss identifier, nullable for event overall),
  leaderboardType: ENUM('boss_specific', 'event_overall'),
  totalDamageDealt: INTEGER (Total damage across all sessions),
  totalCorrectAnswers: INTEGER (Total correct answers),
  sessionsPlayed: INTEGER (Number of sessions played),
  lastPlayedAt: DATE (Last activity timestamp)
}
```

## Ranking Logic

All leaderboards are ranked by:

1. **Primary**: Total Damage Dealt (DESC)
2. **Secondary**: Total Correct Answers (DESC)

## Service Methods

### Update Methods

- `updatePlayerLeaderboard(playerId, eventId, eventBossId, battleStats)`
- `updateBossSpecificLeaderboard(playerId, eventId, eventBossId, totalDamage, correctAnswers)`
- `updateEventOverallLeaderboard(playerId, eventId, totalDamage, correctAnswers)`

### Query Methods

- `getEventOverallLeaderboard(eventId, limit)` - Leaderboard across all bosses in event
- `getBossSpecificLeaderboard(eventId, eventBossId, limit)` - Leaderboard for specific boss
- `getAllTimeLeaderboard(limit)` - Aggregated across all events
- `getBossAllTimeLeaderboard(bossId, limit)` - Specific boss across all events
- `getPlayerStats(playerId)` - Individual player statistics

## Data Structure

All methods return consistent data format:

```javascript
{
  rank: number,
  playerId: string,
  username: string,
  profileImage: string,
  totalDamage: number,
  totalCorrectAnswers: number,
  sessionsPlayed: number,
  lastPlayedAt: Date
}
```

## Usage Example

```javascript
// Update player performance after battle
await LeaderboardService.updatePlayerLeaderboard(
  playerId,
  eventId,
  eventBossId,
  {
    totalDamage: 1500,
    correctAnswers: 8,
  }
);

// Get event leaderboard
const leaderboard = await LeaderboardService.getEventOverallLeaderboard(
  eventId,
  50
);
```

## Benefits

- **Simple**: Focus on core metrics (damage + correct answers)
- **Fast**: Reduced database complexity and query time
- **Clear**: Easy to understand ranking system
- **Scalable**: Efficient for large player bases
