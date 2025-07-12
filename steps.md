# Testing Guide & Frontend Integration

## 🧪 Testing with Postman

# email 1: e26834da-2cec-4469-a279-da280aa6a431@mailslurp.biz
# email 2: edetasuquo23@gmail.com


### Setup Postman Environment

1. **Create Environment Variables**
   ```
   BASE_URL: http://localhost:3000
   TOKEN: (will be set after login)
   USER_ID: (will be set after login)
   TRIP_ID: (will be set after creating trip)
   JOURNAL_ENTRY_ID: (will be set after creating entry)
   PHOTO_ID: (will be set after uploading photo)
   ITINERARY_ID: (will be set after creating itinerary item)
   EXPENSE_ID: (will be set after creating expense)
   ROOM_ID: (will be set for WebSocket testing)
   CLIENT_ID: (will be set for WebSocket testing)
   ```

2. **Import Postman Collection**
   Download the collection from: `postman/Trava_API_Collection.json`

### Authentication Flow

#### 1. Register User
```http
POST {{BASE_URL}}/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "TestPassword123!",
  "fullName": "Test User",
  "username": "testuser"
}
```

**Tests:**
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Response has token", function () {
    const response = pm.response.json();
    pm.expect(response.data.token).to.exist;
    pm.environment.set("TOKEN", response.data.token);
    pm.environment.set("USER_ID", response.data.user.id);
});
```

#### 2. Login User
```http
POST {{BASE_URL}}/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "TestPassword123!"
}
```

**Tests:**
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has token", function () {
    const response = pm.response.json();
    pm.expect(response.data.token).to.exist;
    pm.environment.set("TOKEN", response.data.token);
});
```

### Trip Management

#### 3. Create Trip
```http
POST {{BASE_URL}}/api/trips
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "tripName": "Paris Adventure",
  "startDate": "2024-06-01",
  "endDate": "2024-06-07",
  "description": "Exploring the City of Light",
  "destinationQuery": "Paris, France"
}
```

**Tests:**
```javascript
pm.test("Status code is 201", function () {
    pm.response.to.have.status(201);
});

pm.test("Trip created successfully", function () {
    const response = pm.response.json();
    pm.expect(response.data.tripName).to.eql("Paris Adventure");
    pm.environment.set("TRIP_ID", response.data.id);
});
```

#### 4. Get Trip Details
```http
GET {{BASE_URL}}/api/trips/{{TRIP_ID}}
Authorization: Bearer {{TOKEN}}
```

#### 5. Update Trip Status
```http
PUT {{BASE_URL}}/api/trips/{{TRIP_ID}}/status
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "status": "ACTIVE"
}
```

### Journal Entries

#### 6. Create Journal Entry
```http
POST {{BASE_URL}}/api/journal-entries
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "tripId": "{{TRIP_ID}}",
  "title": "First Day in Paris",
  "content": "Arrived in Paris and visited the Eiffel Tower. The view was absolutely breathtaking!",
  "date": "2024-06-01",
  "isPublic": true
}
```

**Tests:**
```javascript
pm.test("Journal entry created", function () {
    const response = pm.response.json();
    pm.expect(response.data.title).to.eql("First Day in Paris");
    pm.environment.set("JOURNAL_ENTRY_ID", response.data.id);
});
```

#### 7. Search Journal Entries
```http
GET {{BASE_URL}}/api/journal-entries?search=Eiffel Tower&tripId={{TRIP_ID}}
Authorization: Bearer {{TOKEN}}
```

### Photo Management

#### 8. Upload Single Photo
```http
POST {{BASE_URL}}/api/photos/upload
Authorization: Bearer {{TOKEN}}
Content-Type: multipart/form-data

file: [Select image file]
journalEntryId: {{JOURNAL_ENTRY_ID}}
caption: "Eiffel Tower at sunset"
isPublic: true
provider: s3
```

**Tests:**
```javascript
pm.test("Photo uploaded successfully", function () {
    const response = pm.response.json();
    pm.expect(response.data.url).to.exist;
    pm.environment.set("PHOTO_ID", response.data.id);
});
```

#### 9. Upload Multiple Photos
```http
POST {{BASE_URL}}/api/photos/bulk-upload
Authorization: Bearer {{TOKEN}}
Content-Type: multipart/form-data

files: [Select multiple image files]
journalEntryId: {{JOURNAL_ENTRY_ID}}
isPublic: true
provider: s3
captions: ["Photo 1", "Photo 2", "Photo 3"]
```

#### 10. Like Photo
```http
POST {{BASE_URL}}/api/photos/{{PHOTO_ID}}/like
Authorization: Bearer {{TOKEN}}
```

#### 11. Comment on Photo
```http
POST {{BASE_URL}}/api/photos/{{PHOTO_ID}}/comment
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "content": "Beautiful photo! Love the sunset colors."
}
```

### Itinerary Management

#### 12. Create Itinerary Item
```http
POST {{BASE_URL}}/api/itineraries
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "tripId": "{{TRIP_ID}}",
  "day": 1,
  "title": "Visit Eiffel Tower",
  "description": "Explore the iconic Eiffel Tower",
  "startTime": "09:00",
  "endTime": "12:00",
  "location": "Eiffel Tower, Paris",
  "category": "SIGHTSEEING",
  "estimatedCost": 25.50,
  "notes": "Book tickets in advance"
}
```

**Tests:**
```javascript
pm.test("Itinerary item created", function () {
    const response = pm.response.json();
    pm.expect(response.data.title).to.eql("Visit Eiffel Tower");
    pm.environment.set("ITINERARY_ID", response.data.id);
});
```

#### 13. Get Itinerary Items
```http
GET {{BASE_URL}}/api/itineraries?tripId={{TRIP_ID}}&day=1
Authorization: Bearer {{TOKEN}}
```

#### 14. Update Itinerary Item
```http
PATCH {{BASE_URL}}/api/itineraries/{{ITINERARY_ID}}
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "title": "Updated Eiffel Tower Visit",
  "startTime": "10:00",
  "estimatedCost": 30.00
}
```

#### 15. Get Itinerary Statistics
```http
GET {{BASE_URL}}/api/itineraries/{{TRIP_ID}}/stats
Authorization: Bearer {{TOKEN}}
```

#### 16. Get Smart Itinerary Suggestions
```http
GET {{BASE_URL}}/api/itineraries/{{TRIP_ID}}/suggestions
Authorization: Bearer {{TOKEN}}
```

### Expense Management

#### 17. Create Expense
```http
POST {{BASE_URL}}/api/expenses
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "tripId": "{{TRIP_ID}}",
  "title": "Eiffel Tower Tickets",
  "amount": 25.50,
  "currency": "EUR",
  "category": "ENTERTAINMENT",
  "date": "2024-06-01",
  "description": "Entrance tickets for Eiffel Tower",
  "paymentMethod": "CASH",
  "isPlanned": true
}
```

**Tests:**
```javascript
pm.test("Expense created", function () {
    const response = pm.response.json();
    pm.expect(response.data.title).to.eql("Eiffel Tower Tickets");
    pm.environment.set("EXPENSE_ID", response.data.id);
});
```

#### 18. Get Expenses
```http
GET {{BASE_URL}}/api/expenses?tripId={{TRIP_ID}}&category=ENTERTAINMENT
Authorization: Bearer {{TOKEN}}
```

#### 19. Update Expense
```http
PATCH {{BASE_URL}}/api/expenses/{{EXPENSE_ID}}
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "amount": 30.00,
  "description": "Updated ticket price"
}
```

#### 20. Get Expense Statistics
```http
GET {{BASE_URL}}/api/expenses/{{TRIP_ID}}/stats
Authorization: Bearer {{TOKEN}}
```

#### 21. Get Budget Analysis
```http
GET {{BASE_URL}}/api/expenses/{{TRIP_ID}}/budget-analysis
Authorization: Bearer {{TOKEN}}
```

#### 22. Export Expenses CSV
```http
GET {{BASE_URL}}/api/expenses/{{TRIP_ID}}/export
Authorization: Bearer {{TOKEN}}
```

#### 23. Get Smart Budget Suggestions
```http
GET {{BASE_URL}}/api/expenses/{{TRIP_ID}}/suggestions
Authorization: Bearer {{TOKEN}}
```

### Recommendations

#### 24. Get Itinerary Recommendations
```http
GET {{BASE_URL}}/api/recommendations/itinerary?destination=Paris&duration=7&budget=1000&interests=history,culture
Authorization: Bearer {{TOKEN}}
```

#### 25. Get Budget Recommendations
```http
GET {{BASE_URL}}/api/recommendations/budget?destination=Paris&duration=7&travelers=2&style=luxury
Authorization: Bearer {{TOKEN}}
```

#### 26. Get Destination Insights
```http
GET {{BASE_URL}}/api/recommendations/destination/Paris
Authorization: Bearer {{TOKEN}}
```

#### 27. Get Activity Recommendations
```http
GET {{BASE_URL}}/api/recommendations/activities?destination=Paris&interests=history,art&budget=200
Authorization: Bearer {{TOKEN}}
```

#### 28. Get Smart Suggestions
```http
GET {{BASE_URL}}/api/recommendations/smart?tripId={{TRIP_ID}}
Authorization: Bearer {{TOKEN}}
```
POST {{BASE_URL}}/api/photos/{{PHOTO_ID}}/comment
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "content": "Beautiful photo! Love the sunset colors."
}
```

#### 12. Get Photo Comments
```http
GET {{BASE_URL}}/api/photos/{{PHOTO_ID}}/comments
Authorization: Bearer {{TOKEN}}
```

### Expense Tracking

#### 13. Create Expense
```http
POST {{BASE_URL}}/api/expenses
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "tripId": "{{TRIP_ID}}",
  "category": "ACCOMMODATION",
  "amount": 150.00,
  "currency": "EUR",
  "description": "Hotel booking for first night",
  "date": "2024-06-01",
  "location": "Paris, France"
}
```

#### 14. Get Expenses
```http
GET {{BASE_URL}}/api/expenses?tripId={{TRIP_ID}}
Authorization: Bearer {{TOKEN}}
```

### Packing Lists

#### 15. Create Packing List
```http
POST {{BASE_URL}}/api/packing-lists
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "tripId": "{{TRIP_ID}}",
  "name": "Summer Trip Essentials",
  "items": [
    {
      "name": "Passport",
      "category": "DOCUMENTS",
      "isPacked": false
    },
    {
      "name": "Sunscreen",
      "category": "TOILETRIES",
      "isPacked": false
    }
  ]
}
```

### Destinations

#### 16. Create Destination
```http
POST {{BASE_URL}}/api/destinations
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "name": "Santorini, Greece",
  "country": "Greece",
  "description": "Stunning island with white buildings and blue domes",
  "imageUrl": "https://example.com/santorini.jpg",
  "locationQuery": "Santorini, Greece",
  "bestTimeToVisit": "May to October"
}
```

#### 17. Search Destinations
```http
GET {{BASE_URL}}/api/destinations?search=island paradise
Authorization: Bearer {{TOKEN}}
```

### Gamification

#### 18. Get User Badges
```http
GET {{BASE_URL}}/api/badges
Authorization: Bearer {{TOKEN}}
```

### User Settings

#### 19. Get User Settings
```http
GET {{BASE_URL}}/api/user-settings
Authorization: Bearer {{TOKEN}}
```

#### 20. Update User Settings
```http
PUT {{BASE_URL}}/api/user-settings
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "emailNotifications": true,
  "pushNotifications": false,
  "privacyLevel": "FRIENDS_ONLY",
  "language": "en",
  "currency": "USD",
  "timezone": "UTC"
}
```

## 🎯 Frontend Integration

### React Integration Example

#### 1. API Client Setup
```typescript
// src/services/api.ts
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

#### 2. Authentication Hooks
```typescript
// src/hooks/useAuth.ts
import { useState, useEffect } from 'react';
import api from '../services/api';

interface User {
  id: string;
  email: string;
  fullName: string;
  username: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const { token, user } = response.data.data;
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const register = async (userData: any) => {
    const response = await api.post('/auth/register', userData);
    const { token, user } = response.data.data;
    localStorage.setItem('token', token);
    setUser(user);
    return user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user data
      api.get('/auth/me')
        .then(response => setUser(response.data.data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  return { user, loading, login, register, logout };
};
```

#### 3. Trip Management
```typescript
// src/hooks/useTrips.ts
import { useState } from 'react';
import api from '../services/api';

export const useTrips = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  const createTrip = async (tripData: any) => {
    setLoading(true);
    try {
      const response = await api.post('/trips', tripData);
      setTrips(prev => [...prev, response.data.data]);
      return response.data.data;
    } finally {
      setLoading(false);
    }
  };

  const getTrips = async () => {
    setLoading(true);
    try {
      const response = await api.get('/trips');
      setTrips(response.data.data);
      return response.data.data;
    } finally {
      setLoading(false);
    }
  };

  return { trips, loading, createTrip, getTrips };
};
```

#### 4. Photo Upload Component
```typescript
// src/components/PhotoUpload.tsx
import React, { useState } from 'react';
import api from '../services/api';

interface PhotoUploadProps {
  journalEntryId: string;
  onUploadComplete: (photo: any) => void;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({ 
  journalEntryId, 
  onUploadComplete 
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = async (files: FileList) => {
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    formData.append('journalEntryId', journalEntryId);
    formData.append('isPublic', 'true');
    formData.append('provider', 's3');

    try {
      const response = await api.post('/photos/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total!
          );
          setProgress(percentCompleted);
        },
      });

      onUploadComplete(response.data.data);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        disabled={uploading}
      />
      {uploading && (
        <div>
          <progress value={progress} max="100" />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
};
```

#### 5. Real-time Notifications
```typescript
// src/hooks/useNotifications.ts
import { useState, useEffect } from 'react';
import api from '../services/api';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  const getNotifications = async () => {
    const response = await api.get('/notifications');
    setNotifications(response.data.data);
  };

  const markAsRead = async (notificationId: string) => {
    await api.put(`/notifications/${notificationId}/read`);
    setNotifications(prev => 
      prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      )
    );
  };

  useEffect(() => {
    getNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(getNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return { notifications, markAsRead, getNotifications };
};
```

### Vue.js Integration Example

#### 1. API Service
```typescript
// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.VUE_APP_API_URL || 'http://localhost:3000',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

#### 2. Vuex Store
```typescript
// src/store/index.ts
import { createStore } from 'vuex';
import api from '../services/api';

export default createStore({
  state: {
    user: null,
    trips: [],
    notifications: [],
  },
  mutations: {
    SET_USER(state, user) {
      state.user = user;
    },
    SET_TRIPS(state, trips) {
      state.trips = trips;
    },
    ADD_TRIP(state, trip) {
      state.trips.push(trip);
    },
    SET_NOTIFICATIONS(state, notifications) {
      state.notifications = notifications;
    },
  },
  actions: {
    async login({ commit }, credentials) {
      const response = await api.post('/auth/login', credentials);
      const { token, user } = response.data.data;
      localStorage.setItem('token', token);
      commit('SET_USER', user);
      return user;
    },
    async createTrip({ commit }, tripData) {
      const response = await api.post('/trips', tripData);
      commit('ADD_TRIP', response.data.data);
      return response.data.data;
    },
  },
});
```

### Testing Queue System

#### 1. Monitor Queue Status
```bash
# Check queue health
curl http://localhost:3000/health/queues

# Expected response:
{
  "success": true,
  "data": {
    "trip-queue": {
      "waiting": 0,
      "active": 0,
      "completed": 5,
      "failed": 0
    },
    "photo-queue": {
      "waiting": 0,
      "active": 0,
      "completed": 3,
      "failed": 0
    }
  }
}
```

#### 2. Test Content Moderation
```bash
# Upload photo with inappropriate caption
curl -X POST http://localhost:3000/api/photos/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test-image.jpg" \
  -F "caption=spam content here" \
  -F "journalEntryId=$JOURNAL_ENTRY_ID"

# Check moderation status
curl http://localhost:3000/api/photos/$PHOTO_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### 3. Test Weather Updates
```bash
# Create trip with location
curl -X POST http://localhost:3000/api/trips \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tripName": "Weather Test",
    "destinationQuery": "London, UK"
  }'

# Check weather data after processing
curl http://localhost:3000/api/trips/$TRIP_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Performance Testing

#### 1. Load Testing with Artillery
```yaml
# artillery-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      Authorization: 'Bearer {{ $randomString() }}'

scenarios:
  - name: "Trip Creation"
    weight: 30
    flow:
      - post:
          url: "/api/trips"
          json:
            tripName: "Test Trip {{ $randomNumber() }}"
            destinationQuery: "Paris, France"

  - name: "Photo Upload"
    weight: 20
    flow:
      - post:
          url: "/api/photos/upload"
          form:
            file: "@test-image.jpg"
            journalEntryId: "{{ $randomString() }}"

  - name: "Journal Entry Creation"
    weight: 50
    flow:
      - post:
          url: "/api/journal-entries"
          json:
            title: "Test Entry {{ $randomNumber() }}"
            content: "Test content"
            tripId: "{{ $randomString() }}"
```

```bash
# Run load test
artillery run artillery-config.yml
```

### Error Handling Examples

#### 1. Rate Limiting
```javascript
// Frontend error handling
try {
  const response = await api.post('/photos/upload', formData);
} catch (error) {
  if (error.response?.status === 429) {
    showNotification('Rate limit exceeded. Please wait before trying again.');
  } else {
    showNotification('Upload failed. Please try again.');
  }
}
```

#### 2. Content Moderation
```javascript
// Handle moderation status
const checkModerationStatus = async (contentId, contentType) => {
  const response = await api.get(`/${contentType}/${contentId}`);
  const status = response.data.data.status;
  
  switch (status) {
    case 'PENDING':
      showNotification('Content is being reviewed...');
      break;
    case 'MODERATION_FAILED':
      showNotification('Content was rejected: ' + response.data.data.moderationReason);
      break;
    case 'APPROVED':
      showNotification('Content approved!');
      break;
  }
};
```

### WebSocket Testing

#### 1. WebSocket Connection Test
```javascript
// Test WebSocket connection
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', () => {
  console.log('Connected to WebSocket');
  
  // Send authentication
  ws.send(JSON.stringify({
    type: 'authenticate',
    payload: {
      token: 'your-jwt-token'
    }
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('WebSocket connection closed');
});
```

#### 2. Join Trip Room
```javascript
// After authentication, join a trip room
ws.send(JSON.stringify({
  type: 'join_room',
  payload: {
    roomId: 'trip_123',
    roomType: 'trip'
  }
}));
```

#### 3. Send Real-time Message
```javascript
// Send a chat message to the room
ws.send(JSON.stringify({
  type: 'message_sent',
  payload: {
    roomId: 'trip_123',
    content: 'Hello from WebSocket!',
    messageType: 'chat'
  }
}));
```

#### 4. Test Admin WebSocket Endpoints

**Get WebSocket Statistics:**
```http
GET {{BASE_URL}}/api/websocket/stats
Authorization: Bearer {{TOKEN}}
```

**Get Room Information:**
```http
GET {{BASE_URL}}/api/websocket/rooms/{{ROOM_ID}}
Authorization: Bearer {{TOKEN}}
```

**Get Client Information:**
```http
GET {{BASE_URL}}/api/websocket/clients/{{CLIENT_ID}}
Authorization: Bearer {{TOKEN}}
```

**Broadcast Message:**
```http
POST {{BASE_URL}}/api/websocket/broadcast
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "message": "Server maintenance in 5 minutes",
  "type": "maintenance_notice",
  "excludeUsers": []
}
```

**Broadcast to Room:**
```http
POST {{BASE_URL}}/api/websocket/broadcast/room
Authorization: Bearer {{TOKEN}}
Content-Type: application/json

{
  "roomId": "{{ROOM_ID}}",
  "message": "Trip itinerary updated",
  "type": "trip_update",
  "excludeUsers": []
}
```

#### 5. Frontend WebSocket Integration
```javascript
// WebSocket service for frontend
class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect(token) {
    this.ws = new WebSocket('ws://localhost:3000/ws');
    
    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.authenticate(token);
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.reconnect(token);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  authenticate(token) {
    this.send({
      type: 'authenticate',
      payload: { token }
    });
  }

  joinRoom(roomId, roomType = 'trip') {
    this.send({
      type: 'join_room',
      payload: { roomId, roomType }
    });
  }

  leaveRoom(roomId) {
    this.send({
      type: 'leave_room',
      payload: { roomId }
    });
  }

  sendMessage(roomId, content, messageType = 'chat') {
    this.send({
      type: 'message_sent',
      payload: { roomId, content, messageType }
    });
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  handleMessage(message) {
    switch (message.type) {
      case 'trip_updated':
        this.handleTripUpdate(message.payload);
        break;
      case 'message_sent':
        this.handleChatMessage(message.payload);
        break;
      case 'notification':
        this.handleNotification(message.payload);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  reconnect(token) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
        this.connect(token);
      }, 1000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Usage in Vue component
export default {
  data() {
    return {
      wsService: new WebSocketService(),
      messages: []
    };
  },
  mounted() {
    const token = localStorage.getItem('token');
    this.wsService.connect(token);
    this.wsService.joinRoom(this.tripId);
  },
  beforeUnmount() {
    this.wsService.disconnect();
  },
  methods: {
    handleChatMessage(payload) {
      this.messages.push(payload);
    },
    sendMessage(content) {
      this.wsService.sendMessage(this.tripId, content);
    }
  }
};
```

This comprehensive testing guide covers all major functionality including WebSocket integration and provides practical examples for frontend integration. 