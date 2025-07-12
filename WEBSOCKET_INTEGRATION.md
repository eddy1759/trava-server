# WebSocket Integration Documentation

## Overview
The Trava server now includes a comprehensive WebSocket service for real-time communication, enabling live collaboration on trips, photo sharing, journal entries, and social features.

## WebSocket Endpoint
- **URL**: `ws://localhost:3000/ws` (or your server URL)
- **Authentication**: JWT token required in connection handshake

## Features

### 1. Real-time Trip Collaboration
- Live updates when trip details change
- Real-time itinerary modifications
- Instant expense updates and budget tracking
- Collaborative trip planning

### 2. Photo Management
- Real-time photo uploads and sharing
- Live comments and reactions
- Photo album collaboration
- Instant photo notifications

### 3. Social Features
- Live chat in trip rooms
- Real-time notifications
- Social interactions and reactions
- Group activities and events

### 4. Journal Entries
- Live journal writing and editing
- Real-time collaboration on travel blogs
- Instant publishing and sharing
- Live comments and feedback

## Connection Setup

### Client Connection
```javascript
// Connect to WebSocket with authentication
const ws = new WebSocket('ws://localhost:3000/ws');

// Send authentication message
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    payload: {
      token: 'your-jwt-token'
    }
  }));
};
```

### Message Format
All WebSocket messages follow this structure:
```javascript
{
  type: 'message_type',
  payload: {
    // message specific data
  },
  timestamp: Date.now()
}
```

## Room Management

### Join Trip Room
```javascript
ws.send(JSON.stringify({
  type: 'join_room',
  payload: {
    roomId: 'trip_123',
    roomType: 'trip'
  }
}));
```

### Leave Room
```javascript
ws.send(JSON.stringify({
  type: 'leave_room',
  payload: {
    roomId: 'trip_123'
  }
}));
```

## Event Types

### Trip Events
- `trip_updated` - Trip details changed
- `itinerary_modified` - Itinerary updated
- `expense_added` - New expense logged
- `budget_updated` - Budget information changed

### Photo Events
- `photo_uploaded` - New photo added
- `photo_commented` - Comment on photo
- `photo_liked` - Photo liked/reacted to
- `album_updated` - Photo album modified

### Social Events
- `message_sent` - Chat message
- `notification` - System notification
- `user_joined` - User joined room
- `user_left` - User left room

### Journal Events
- `journal_entry_created` - New journal entry
- `journal_entry_updated` - Entry modified
- `journal_entry_published` - Entry published
- `journal_comment` - Comment on entry

## Admin Features

### WebSocket Statistics
```bash
GET /api/websocket/stats
Authorization: Bearer <admin-token>
```

### Room Information
```bash
GET /api/websocket/rooms/:roomId
Authorization: Bearer <admin-token>
```

### Client Information
```bash
GET /api/websocket/clients/:clientId
Authorization: Bearer <admin-token>
```

### Broadcast Messages
```bash
POST /api/websocket/broadcast
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "message": "Server maintenance in 5 minutes",
  "type": "maintenance_notice"
}
```

### Room Broadcast
```bash
POST /api/websocket/broadcast/room
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "roomId": "trip_123",
  "message": "Trip itinerary updated",
  "type": "trip_update"
}
```

## Security Features

### Authentication
- JWT token validation on connection
- Automatic disconnection for invalid tokens
- User context maintained throughout session

### Rate Limiting
- Message rate limiting per client
- Connection limits per user
- Flood protection

### Room Access Control
- Trip membership verification
- Private room access control
- Admin override capabilities

## Error Handling

### Connection Errors
- Automatic reconnection attempts
- Exponential backoff
- Connection state management

### Message Errors
- Invalid message format handling
- Missing authentication responses
- Room access denied notifications

## Monitoring and Logging

### Server Statistics
- Active connections count
- Room participation metrics
- Message throughput
- Error rates

### Client Monitoring
- Connection duration
- Message activity
- Room participation
- Error tracking

## Integration with REST API

The WebSocket service works alongside the REST API:
- REST API for CRUD operations
- WebSocket for real-time updates
- Consistent data models
- Shared authentication

## Performance Considerations

### Scalability
- Horizontal scaling support
- Redis-based session sharing
- Load balancing ready
- Connection pooling

### Resource Management
- Automatic cleanup of inactive connections
- Memory usage monitoring
- Connection limits per server
- Graceful degradation

## Development and Testing

### Local Development
```bash
# Start server with WebSocket support
npm run dev

# WebSocket endpoint available at
ws://localhost:3000/ws
```

### Testing WebSocket
```javascript
// Test connection
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  console.log('Connected to WebSocket');
});

ws.on('message', (data) => {
  console.log('Received:', JSON.parse(data));
});
```

## Next Steps

1. **Frontend Integration**: Implement WebSocket client in frontend
2. **Real-time Features**: Add live collaboration features
3. **Mobile Support**: WebSocket support for mobile apps
4. **Advanced Features**: Voice/video chat, file sharing
5. **Analytics**: Real-time usage analytics and insights

## Support

For WebSocket-related issues:
- Check server logs for connection errors
- Verify JWT token validity
- Monitor WebSocket statistics via admin endpoints
- Review room access permissions 