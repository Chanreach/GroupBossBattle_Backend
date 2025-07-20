# Leaderboard System Enhancements

## Overview

The leaderboard system has been completely redesigned to provide more accurate tracking, better performance metrics, and dual-scope leaderboards.

## Key Improvements

### 1. Enhanced Data Model

- **Accuracy Tracking**: Precise answer accuracy percentages calculated automatically
- **Performance Metrics**: Average damage per session, best single session damage
- **Dual Leaderboard Types**:
  - `boss_specific`: Track performance against individual bosses
  - `event_overall`: Track cumulative performance across all bosses in an event

### 2. Database Schema Updates

- Added `username` column to `player_sessions` for better player identification
- Enhanced `leaderboards` table with:
  - `total_questions_answered` for accurate percentage calculations
  - `answer_accuracy` (DECIMAL) for precise accuracy tracking
  - `average_damage_per_session` (DECIMAL) for performance metrics
  - `best_single_session_damage` to track peak performance
  - `leaderboard_type` ENUM to distinguish boss-specific vs event-overall
  - `event_boss_id` (nullable) for boss-specific tracking
- Added proper indexes for optimized queries

### 3. Service Layer Enhancements

#### New Query Methods

```javascript
// Get event overall leaderboard (across all bosses)
LeaderboardService.getEventOverallLeaderboard(eventId, limit, sortBy);

// Get boss-specific leaderboard
LeaderboardService.getBossSpecificLeaderboard(
  eventId,
  eventBossId,
  limit,
  sortBy
);

// Get all-time leaderboard (aggregated across all events)
LeaderboardService.getAllTimeLeaderboard(limit, sortBy);

// Get boss all-time leaderboard (across all events for specific boss)
LeaderboardService.getBossAllTimeLeaderboard(bossId, limit, sortBy);

// Get individual player statistics
LeaderboardService.getPlayerStats(playerId);
```

#### Sorting Options

All leaderboard methods support multiple sorting criteria:

- `damage`: Sort by total damage dealt (default)
- `accuracy`: Sort by answer accuracy percentage
- `sessions`: Sort by number of sessions played
- `average`: Sort by average damage per session

### 4. Consistent Data Structure

All methods now use consistent return format:

```javascript
{
  rank: number,
  playerId: string,
  username: string,
  profileImage: string,
  totalDamage: number,
  totalCorrectAnswers: number,
  totalQuestionsAnswered: number,
  answerAccuracy: number, // Percentage with 2 decimal places
  averageDamagePerSession: number, // With 2 decimal places
  sessionsPlayed: number,
  bestSingleSessionDamage: number,
  lastPlayedAt: Date
}
```

### 5. Performance Optimizations

- Database indexes on frequently queried columns
- Efficient aggregation queries using Sequelize functions
- Proper grouping and ordering for large datasets

### 6. Migration Applied

The database migration `migrate-player-session-leaderboard.js` has been successfully executed:

- Added username column to player_sessions
- Enhanced leaderboards table with new tracking columns
- Created proper indexes for query optimization
- Added constraints for data integrity

## Usage Examples

### Get Event Overall Leaderboard

```javascript
const leaderboard = await LeaderboardService.getEventOverallLeaderboard(
  eventId,
  50,
  "accuracy" // Sort by accuracy
);
```

### Get Boss-Specific Performance

```javascript
const bossLeaderboard = await LeaderboardService.getBossSpecificLeaderboard(
  eventId,
  eventBossId,
  25,
  "damage" // Sort by total damage
);
```

### Update Player Performance

```javascript
await LeaderboardService.updatePlayerLeaderboard(
  playerId,
  eventId,
  eventBossId,
  {
    totalDamage: 1500,
    correctAnswers: 8,
    totalQuestions: 10,
    bestSessionDamage: 500,
  }
);
```

## Benefits

1. **Accurate Tracking**: Precise calculation of answer accuracy and performance metrics
2. **Flexible Sorting**: Multiple sort options for different leaderboard views
3. **Dual Scope**: Both boss-specific and event-wide performance tracking
4. **Better UX**: Rich data for displaying comprehensive player statistics
5. **Scalable**: Optimized queries and proper indexing for performance
6. **Consistent**: Unified data structure across all leaderboard methods

## Next Steps

- Update frontend components to use new leaderboard methods
- Implement accuracy-based badge milestones
- Add real-time leaderboard updates via Socket.IO
- Consider adding team-based leaderboard aggregation
