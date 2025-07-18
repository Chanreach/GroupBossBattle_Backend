# Boss Preview Socket Implementation

## Overview

This implementation provides a complete socket-based boss preview system that allows players to join boss fight sessions, see real-time player counts, handle team assignments, manage cooldowns, and start battles automatically.

## Features Implemented

### 1. **Player Join System**
- Players scan QR code to get `bossId` and `eventId`
- Navigate to boss preview page with URL parameters
- Socket connection established automatically
- Real-time player count updates

### 2. **Nickname System**
- Required nickname input (2-20 characters)
- Validation on both frontend and backend
- Nickname displayed to other players

### 3. **Boss Preview Features**
- Dynamic boss information display (name, image, description)
- Real-time player count
- Ready player count
- Connection status indicator

### 4. **Ready System**
- Players can click "Join Boss Fight" to mark as ready
- Automatic team assignment (load-balanced)
- Minimum 2 players (1 per team) required to start
- Cancel ready functionality

### 5. **Cooldown Management**
- Boss cooldown status checking
- Cooldown timer display (MM:SS format)
- Button disabled during cooldown
- Real-time cooldown updates

### 6. **Battle Start System**
- Automatic battle start when minimum players ready
- 5-second countdown before battle begins
- Automatic redirect to battle page
- Real-time countdown updates to all players

### 7. **Leaderboard Integration**
- Team rankings
- Individual player rankings
- All-time leaderboard
- Real-time leaderboard updates

## Socket Events

### Client to Server Events

#### `boss-preview:join`
```javascript
{
  bossId: string,
  eventId: string,
  nickname: string
}
```

#### `boss-preview:ready`
No parameters required

#### `boss-preview:cancel-ready`
No parameters required

#### `boss-preview:get-leaderboard`
No parameters required

#### `boss-preview:leave`
No parameters required

### Server to Client Events

#### `boss-preview:joined`
```javascript
{
  success: boolean,
  player: {
    playerId: string,
    nickname: string,
    status: string
  },
  boss: {
    id: string,
    name: string,
    description: string,
    image: string,
    numberOfTeams: number,
    cooldownDuration: number
  },
  session: {
    totalPlayers: number,
    readyPlayers: number,
    status: string,
    cooldown: {
      isOnCooldown: boolean,
      timeRemaining: number,
      formattedTime: string
    }
  }
}
```

#### `boss-preview:player-joined`
```javascript
{
  player: {
    playerId: string,
    nickname: string
  },
  totalPlayers: number
}
```

#### `boss-preview:player-ready`
```javascript
{
  player: {
    playerId: string,
    nickname: string,
    teamId: number
  },
  session: {
    readyPlayers: number,
    totalPlayers: number,
    canStart: boolean
  }
}
```

#### `boss-preview:battle-starting`
```javascript
{
  countdown: number,
  message: string
}
```

#### `boss-preview:battle-started`
```javascript
{
  message: string,
  redirectTo: string
}
```

#### `boss-preview:error`
```javascript
{
  message: string
}
```

## Data Flow

1. **Player Scans QR Code**
   - Gets `joinCode` from QR
   - Navigates to boss preview with `bossId` and `eventId`

2. **Socket Connection**
   - Automatic socket connection on page load
   - Connection status indicator

3. **Join Preview**
   - Player enters nickname
   - Clicks join button
   - Socket emits `boss-preview:join`
   - Server validates and adds player to session
   - Real-time updates to all players

4. **Ready for Battle**
   - Player clicks "Join Boss Fight"
   - Socket emits `boss-preview:ready`
   - Server assigns team and marks ready
   - Check if minimum players reached

5. **Battle Start**
   - When enough players ready, server starts countdown
   - All players see countdown timer
   - Automatic redirect to battle page

## Database Integration

### Required Models
- `EventBoss` - Links events to bosses
- `Boss` - Boss information and settings
- `BossSession` - Battle session records
- `PlayerSession` - Player participation records

### Team Assignment
- Automatic load-balanced team assignment
- Teams created based on `boss.numberOfTeams`
- Players distributed evenly across teams

### Cooldown System
- Boss status: `active` or `cooldown`
- Cooldown duration from boss settings
- Real-time cooldown tracking

## UI Features

### Boss Preview Card
- Boss name and image
- Player count display
- Ready player count
- Connection status
- Dynamic button states

### Button States
1. **Join Preview** - When not joined
2. **Join Boss Fight** - When joined but not ready
3. **Waiting for X players** - When ready
4. **Boss on cooldown: MM:SS** - During cooldown
5. **Battle starting in X...** - During countdown

### Leaderboard Tabs
- Team Rankings
- Individual Rankings  
- All-Time Rankings
- Pagination support
- Real-time updates

## Error Handling

### Client Side
- Connection status monitoring
- Graceful error display
- Automatic reconnection
- Parameter validation

### Server Side
- Input validation
- Database error handling
- Session cleanup
- Graceful disconnection handling

## Performance Considerations

### Memory Management
- Session cleanup on disconnect
- Empty session removal
- Efficient data structures

### Network Optimization
- Event-based updates only
- Minimal data transfer
- Batch operations where possible

### Scalability
- Room-based socket organization
- Efficient player lookup
- Database query optimization

## Security Features

### Validation
- Nickname length limits
- Required field validation
- Session verification

### Access Control
- Event status checking
- Boss availability verification
- Player session management

## Future Enhancements

1. **Persistent Sessions**
   - Database-backed sessions
   - Reconnection handling
   - Session recovery

2. **Advanced Team Assignment**
   - Skill-based matching
   - Player preferences
   - Team balancing

3. **Enhanced Cooldowns**
   - Dynamic cooldown calculation
   - Cooldown skip functionality
   - Administrative controls

4. **Real Leaderboards**
   - Database integration
   - Historical data
   - Advanced statistics

5. **Mobile Optimization**
   - Touch interactions
   - Responsive design
   - Offline handling

## Installation & Setup

1. **Install Dependencies**
   ```bash
   cd GroupBossBattle
   npm install socket.io-client
   
   cd ../GroupBossBattle_Backend
   npm install socket.io
   ```

2. **Environment Variables**
   ```env
   VITE_SOCKET_URL=http://localhost:3000
   VITE_API_URL=http://localhost:3000/api
   ```

3. **Start Services**
   ```bash
   # Backend
   cd GroupBossBattle_Backend
   npm start
   
   # Frontend  
   cd GroupBossBattle
   npm run dev
   ```

4. **Test URL Format**
   ```
   http://localhost:5173/boss-preview?bossId=123&eventId=456
   ```

## Testing

### Manual Testing Steps
1. Open multiple browser tabs
2. Navigate to boss preview with test parameters
3. Enter different nicknames
4. Test join/ready functionality
5. Verify real-time updates
6. Test cooldown scenarios
7. Test battle start sequence

### Socket Testing
- Use browser dev tools to monitor socket events
- Check network tab for socket connections
- Verify event data structures
- Test error scenarios

This implementation provides a solid foundation for the boss preview system with room for future enhancements and optimizations.
