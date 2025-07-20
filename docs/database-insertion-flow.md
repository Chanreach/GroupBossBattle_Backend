# Database Insertion Flow After Boss Fight

## 🎯 **Implementation Strategy**

**✅ Chosen Approach: Insert Everything After Boss Defeat**

All database records are created in a single transaction after the boss is defeated, ensuring complete and consistent data.

## 📊 **Database Insertion Sequence**

### **1. Player Session Records**

```javascript
// Inserted immediately after boss defeat
const playerSessionInserts = [];
for (const [playerId, player] of session.players) {
  playerSessionInserts.push({
    id: uuidv4(),
    bossSessionId: session.bossSessionId, // Links to boss fight
    userId: player.userId, // Player identifier
    nickname: player.nickname, // Display name
    username: player.username, // Actual username
    teamId: player.teamId, // Team assignment
    damageDealt: player.totalDamage, // Total damage in this fight
    correctAnswers: player.correctAnswers, // Correct answers in this fight
    isWinner: winningTeam.players.has(playerId), // Winner status
  });
}

await PlayerSession.bulkCreate(playerSessionInserts);
```

### **2. Badge Records**

```javascript
// Awards processed during boss defeat:

// MVP Badge (highest damage)
await BadgeService.awardMVPBadge(mvpPlayer.userId, bossSessionId, mvpDamage);

// Last Hit Badge (final blow)
await BadgeService.awardLastHitBadge(finalHitPlayer.userId, bossSessionId);

// Boss Defeated Badges (winning team)
await BadgeService.awardBossDefeatedBadges(winningPlayerIds, bossSessionId);

// Milestone Badges (event-wide progress)
await BadgeService.awardMilestoneBadge(
  player.userId,
  eventId,
  totalCorrectAnswers
);
```

### **3. Leaderboard Records**

```javascript
// Two leaderboard entries per player per boss fight:

// Boss-Specific Leaderboard
await LeaderboardService.updateBossSpecificLeaderboard(
  playerId,
  eventId,
  eventBossId,
  totalDamage,
  correctAnswers
);

// Event-Overall Leaderboard (cumulative)
await LeaderboardService.updateEventOverallLeaderboard(
  playerId,
  eventId,
  totalDamage,
  correctAnswers
);
```

## 🗄️ **Database Tables Updated**

### **player_sessions**

```sql
CREATE TABLE player_sessions (
  id VARCHAR(36) PRIMARY KEY,
  boss_session_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  nickname VARCHAR(255),
  username VARCHAR(255),
  team_id VARCHAR(36),
  damage_dealt INT DEFAULT 0,
  correct_answers INT DEFAULT 0,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **leaderboards**

```sql
CREATE TABLE leaderboards (
  id VARCHAR(36) PRIMARY KEY,
  player_id VARCHAR(36) NOT NULL,
  event_id VARCHAR(36) NOT NULL,
  event_boss_id VARCHAR(36) NULL,              -- NULL for event_overall
  leaderboard_type ENUM('boss_specific', 'event_overall'),
  total_damage_dealt INT DEFAULT 0,
  total_correct_answers INT DEFAULT 0,
  sessions_played INT DEFAULT 0,
  last_played_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### **user_badges**

```sql
CREATE TABLE user_badges (
  id VARCHAR(36) PRIMARY KEY,
  player_id VARCHAR(36) NOT NULL,
  badge_id VARCHAR(36) NOT NULL,
  boss_session_id VARCHAR(36) NULL,            -- Links to specific fight
  earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## ⚡ **Execution Flow**

```
Boss Defeated Event Triggered
    ↓
1. Calculate MVP, Last Hit, Winning Team
    ↓
2. Award Badges (MVP, Last Hit, Boss Defeated, Milestones)
    ↓
3. Insert Player Session Records (bulk insert)
    ↓
4. Update Leaderboards (boss-specific + event-overall)
    ↓
5. Broadcast Final Results
    ↓
6. Update Boss Session Record (completion time, final damage)
```

## 🔄 **Error Handling**

Each database operation is wrapped in try-catch blocks:

- **Badge errors**: Don't stop the overall process
- **Player session errors**: Logged but don't block leaderboards
- **Leaderboard errors**: Don't prevent boss session completion
- **Boss session update errors**: Logged but don't affect player experience

## 📈 **Performance Benefits**

- **Single Transaction**: All related data inserted atomically
- **Bulk Operations**: Player sessions inserted in one operation
- **Parallel Processing**: Badge awards and leaderboard updates can run concurrently
- **Error Resilience**: Individual failures don't break the entire flow

## 🎮 **Data Relationships**

```
BossSession (1) ←→ (Many) PlayerSessions
    ↓
PlayerSession.userId ←→ UserBadge.playerId
    ↓
PlayerSession.userId ←→ Leaderboard.playerId
    ↓
All linked by eventId, eventBossId, bossSessionId for complete fight tracking
```

This approach ensures that all player performance data, achievements, and rankings are properly recorded and linked together for comprehensive battle history and progress tracking! 🏆
