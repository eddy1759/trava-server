# Trava Travel Assistant API Documentation

## Overview

Trava is a comprehensive travel assistant API built with Node.js, TypeScript, Prisma, and PostgreSQL. It features real-time trip planning, social interactions, AI-powered recommendations, and robust queue-based processing.

## Architecture

### Core Technologies
- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Queue System**: BullMQ (Redis) + RabbitMQ
- **File Storage**: AWS S3 + Cloudinary
- **AI/ML**: Google Gemini API with RAG
- **Caching**: Redis
- **Authentication**: JWT
- **Real-time**: WebSocket with Socket.io

### Queue Architecture
- **BullMQ Queues**: trip-queue, rag-queue, photo-queue, content-moderation-queue, weather-queue, notification-queue, ai-optimization-queue
- **RabbitMQ**: email-queue for email notifications
- **Workers**: Separate worker processes for each queue type

## Authentication

### JWT Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "uuid",
    "email": "user@example.com",
    "iat": 1234567890,
    "exp": 1234567890
  }
}
```

### Authentication Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## API Endpoints

### Authentication

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "fullName": "John Doe",
  "username": "johndoe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "username": "johndoe"
    },
    "token": "jwt_token"
  }
}
```

#### POST /api/auth/login
Authenticate user and get access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### POST /api/auth/verify-email
Verify email address with token.

**Request Body:**
```json
{
  "token": "verification_token"
}
```

#### POST /api/auth/forgot-password
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### Trips

#### POST /api/trips
Create a new trip.

**Request Body:**
```json
{
  "tripName": "Paris Adventure",
  "startDate": "2024-06-01",
  "endDate": "2024-06-07",
  "description": "Exploring the City of Light",
  "destinationQuery": "Paris, France"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tripName": "Paris Adventure",
    "startDate": "2024-06-01T00:00:00.000Z",
    "endDate": "2024-06-07T00:00:00.000Z",
    "description": "Exploring the City of Light",
    "tripStatus": "DRAFT",
    "location": {
      "id": "uuid",
      "name": "Paris",
      "countryCode": "FR",
      "lat": 48.8566,
      "lng": 2.3522
    }
  }
}
```

#### GET /api/trips/:tripId
Get trip details.

#### PUT /api/trips/:tripId/status
Update trip status.

**Request Body:**
```json
{
  "status": "ACTIVE"
}
```

### Itinerary Management

#### POST /api/itineraries
Create an itinerary item.

**Request Body:**
```json
{
  "tripId": "uuid",
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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tripId": "uuid",
    "day": 1,
    "title": "Visit Eiffel Tower",
    "description": "Explore the iconic Eiffel Tower",
    "startTime": "09:00",
    "endTime": "12:00",
    "location": "Eiffel Tower, Paris",
    "category": "SIGHTSEEING",
    "estimatedCost": 25.50,
    "notes": "Book tickets in advance",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /api/itineraries
List itinerary items with filtering.

**Query Parameters:**
- `tripId`: Filter by trip
- `day`: Filter by day number
- `category`: Filter by category
- `skip`: Pagination offset
- `take`: Page size

#### PATCH /api/itineraries/:id
Update an itinerary item.

**Request Body:**
```json
{
  "title": "Updated Eiffel Tower Visit",
  "startTime": "10:00",
  "estimatedCost": 30.00
}
```

#### DELETE /api/itineraries/:id
Delete an itinerary item.

#### GET /api/itineraries/:tripId/stats
Get itinerary statistics for a trip.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalItems": 15,
    "totalDays": 7,
    "totalEstimatedCost": 450.75,
    "categories": {
      "SIGHTSEEING": 8,
      "FOOD": 4,
      "TRANSPORT": 3
    },
    "dailyBreakdown": [
      {
        "day": 1,
        "items": 3,
        "estimatedCost": 75.50
      }
    ]
  }
}
```

#### GET /api/itineraries/:tripId/suggestions
Get smart itinerary suggestions.

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "day": 2,
        "title": "Visit Louvre Museum",
        "description": "World's largest art museum",
        "estimatedCost": 17.00,
        "category": "CULTURE",
        "reason": "Popular attraction near your location"
      }
    ],
    "optimizationTips": [
      "Consider visiting museums on free days",
      "Book tickets online for better prices"
    ]
  }
}
```

### Expense Management

#### POST /api/expenses
Create an expense.

**Request Body:**
```json
{
  "tripId": "uuid",
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

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tripId": "uuid",
    "title": "Eiffel Tower Tickets",
    "amount": 25.50,
    "currency": "EUR",
    "category": "ENTERTAINMENT",
    "date": "2024-06-01T00:00:00.000Z",
    "description": "Entrance tickets for Eiffel Tower",
    "paymentMethod": "CASH",
    "isPlanned": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /api/expenses
List expenses with filtering.

**Query Parameters:**
- `tripId`: Filter by trip
- `category`: Filter by category
- `dateFrom`: Filter from date
- `dateTo`: Filter to date
- `isPlanned`: Filter planned vs actual expenses
- `skip`: Pagination offset
- `take`: Page size

#### PATCH /api/expenses/:id
Update an expense.

**Request Body:**
```json
{
  "amount": 30.00,
  "description": "Updated ticket price"
}
```

#### DELETE /api/expenses/:id
Delete an expense.

#### GET /api/expenses/:tripId/stats
Get expense statistics for a trip.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalExpenses": 1250.75,
    "totalPlanned": 800.00,
    "totalActual": 450.75,
    "currency": "EUR",
    "categories": {
      "ACCOMMODATION": 400.00,
      "FOOD": 250.75,
      "ENTERTAINMENT": 300.00,
      "TRANSPORT": 300.00
    },
    "dailyBreakdown": [
      {
        "date": "2024-06-01",
        "amount": 75.50,
        "count": 3
      }
    ],
    "budgetStatus": {
      "planned": 800.00,
      "actual": 450.75,
      "remaining": 349.25,
      "percentageUsed": 56.34
    }
  }
}
```

#### GET /api/expenses/:tripId/budget-analysis
Get detailed budget analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalBudget": 1000.00,
      "totalSpent": 450.75,
      "remaining": 549.25,
      "percentageUsed": 45.08
    },
    "categoryAnalysis": [
      {
        "category": "ACCOMMODATION",
        "planned": 400.00,
        "actual": 400.00,
        "variance": 0.00,
        "percentage": 88.89
      }
    ],
    "trends": {
      "dailyAverage": 75.13,
      "projectedTotal": 525.88,
      "savingsPotential": 474.12
    },
    "recommendations": [
      "Consider budget-friendly dining options",
      "Look for free activities and attractions"
    ]
  }
}
```

#### GET /api/expenses/:tripId/export
Export expenses to CSV format.

#### GET /api/expenses/:tripId/suggestions
Get smart budget suggestions.

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "category": "FOOD",
        "recommendation": "Try local markets for cheaper meals",
        "potentialSavings": 50.00,
        "difficulty": "EASY"
      }
    ],
    "optimizationTips": [
      "Book activities in advance for better prices",
      "Use public transportation instead of taxis"
    ]
  }
}
```

### Recommendations

#### GET /api/recommendations/itinerary
Get itinerary recommendations.

**Query Parameters:**
- `destination`: Destination name
- `duration`: Trip duration in days
- `budget`: Total budget
- `interests`: Comma-separated interests

**Response:**
```json
{
  "success": true,
  "data": {
    "itinerary": [
      {
        "day": 1,
        "activities": [
          {
            "title": "Visit Eiffel Tower",
            "description": "Iconic Paris landmark",
            "duration": "3 hours",
            "cost": 25.50,
            "category": "SIGHTSEEING"
          }
        ]
      }
    ],
    "totalCost": 450.75,
    "tips": [
      "Book tickets online to avoid queues",
      "Visit early morning for fewer crowds"
    ]
  }
}
```

#### GET /api/recommendations/budget
Get budget recommendations.

**Query Parameters:**
- `destination`: Destination name
- `duration`: Trip duration in days
- `travelers`: Number of travelers
- `style`: Travel style (budget, mid-range, luxury)

**Response:**
```json
{
  "success": true,
  "data": {
    "budgetBreakdown": {
      "accommodation": 400.00,
      "food": 250.00,
      "transportation": 150.00,
      "activities": 200.00,
      "total": 1000.00
    },
    "costSavingTips": [
      "Stay in budget hotels or hostels",
      "Use public transportation",
      "Eat at local markets"
    ],
    "luxuryOptions": {
      "accommodation": 800.00,
      "food": 500.00,
      "transportation": 300.00,
      "activities": 400.00,
      "total": 2000.00
    }
  }
}
```

#### GET /api/recommendations/destination/:destination
Get destination insights.

**Response:**
```json
{
  "success": true,
  "data": {
    "destination": "Paris",
    "country": "France",
    "overview": "City of Light with rich history and culture",
    "bestTimeToVisit": "April to October",
    "averageCosts": {
      "accommodation": 150.00,
      "food": 50.00,
      "transportation": 20.00
    },
    "topAttractions": [
      "Eiffel Tower",
      "Louvre Museum",
      "Notre-Dame Cathedral"
    ],
    "localTips": [
      "Learn basic French phrases",
      "Use the Metro for transportation",
      "Visit museums on free days"
    ]
  }
}
```

#### GET /api/recommendations/activities
Get activity recommendations.

**Query Parameters:**
- `destination`: Destination name
- `interests`: Comma-separated interests
- `budget`: Budget per activity

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "title": "Louvre Museum",
        "description": "World's largest art museum",
        "category": "CULTURE",
        "cost": 17.00,
        "duration": "4 hours",
        "rating": 4.8,
        "tips": "Visit on Wednesday and Friday evenings for free"
      }
    ],
    "filters": {
      "categories": ["CULTURE", "ADVENTURE", "FOOD", "NATURE"],
      "priceRanges": ["FREE", "BUDGET", "MID_RANGE", "LUXURY"]
    }
  }
}
```

#### GET /api/recommendations/smart
Get smart suggestions for a trip.

**Query Parameters:**
- `tripId`: Trip ID

**Response:**
```json
{
  "success": true,
  "data": {
    "itinerarySuggestions": [
      {
        "day": 2,
        "suggestion": "Visit Louvre Museum",
        "reason": "Popular attraction near your location",
        "estimatedCost": 17.00
      }
    ],
    "budgetOptimizations": [
      {
        "category": "FOOD",
        "suggestion": "Try local markets",
        "potentialSavings": 30.00
      }
    ],
    "timingRecommendations": [
      "Visit Eiffel Tower early morning to avoid crowds",
      "Book museum tickets online for better prices"
    ]
  }
}
```

### Journal Entries

#### POST /api/journal-entries
Create a journal entry.

**Request Body:**
```json
{
  "tripId": "uuid",
  "title": "First Day in Paris",
  "content": "Arrived in Paris and visited the Eiffel Tower...",
  "date": "2024-06-01",
  "isPublic": true,
  "photos": ["url1", "url2"]
}
```

#### GET /api/journal-entries
List journal entries with search.

**Query Parameters:**
- `tripId`: Filter by trip
- `search`: Semantic search query
- `isPublic`: Filter public/private entries
- `skip`: Pagination offset
- `take`: Page size

### Photos

#### POST /api/photos/upload
Upload a single photo.

**Request Body (multipart/form-data):**
```
file: [image file]
journalEntryId: "uuid"
caption: "Eiffel Tower at sunset"
isPublic: "true"
provider: "s3" // or "cloudinary"
```

#### POST /api/photos/bulk-upload
Upload multiple photos.

**Request Body (multipart/form-data):**
```
files: [image files]
journalEntryId: "uuid"
isPublic: "true"
provider: "s3"
captions: ["caption1", "caption2"]
```

#### POST /api/photos/:photoId/like
Like a photo.

#### POST /api/photos/:photoId/comment
Comment on a photo.

**Request Body:**
```json
{
  "content": "Beautiful photo!"
}
```

#### GET /api/photos/:photoId/comments
Get photo comments.

#### GET /api/photos/:photoId/likes
Get photo likes.

### Destinations

#### POST /api/destinations
Create a curated destination.

**Request Body:**
```json
{
  "name": "Santorini, Greece",
  "country": "Greece",
  "description": "Stunning island with white buildings and blue domes",
  "imageUrl": "https://example.com/santorini.jpg",
  "locationQuery": "Santorini, Greece",
  "bestTimeToVisit": "May to October"
}
```

#### GET /api/destinations
Search destinations with semantic search.

**Query Parameters:**
- `search`: Search query
- `country`: Filter by country
- `skip`: Pagination offset
- `take`: Page size

### Expenses

#### POST /api/expenses
Create an expense record.

**Request Body:**
```json
{
  "tripId": "uuid",
  "category": "ACCOMMODATION",
  "amount": 150.00,
  "currency": "EUR",
  "description": "Hotel booking",
  "date": "2024-06-01",
  "location": "Paris, France"
}
```

#### GET /api/expenses
List expenses with filtering.

**Query Parameters:**
- `tripId`: Filter by trip
- `category`: Filter by category
- `startDate`: Filter from date
- `endDate`: Filter to date
- `minAmount`: Minimum amount
- `maxAmount`: Maximum amount

### Packing Lists

#### POST /api/packing-lists
Create a packing list.

**Request Body:**
```json
{
  "tripId": "uuid",
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

#### PUT /api/packing-lists/:listId/items
Bulk update packing list items.

**Request Body:**
```json
{
  "items": [
    {
      "id": "uuid",
      "isPacked": true
    }
  ]
}
```

### Gamification

#### GET /api/badges
Get user badges.

#### GET /api/badges/:badgeId
Get specific badge details.

### User Settings

#### GET /api/user-settings
Get user settings.

#### PUT /api/user-settings
Update user settings.

**Request Body:**
```json
{
  "emailNotifications": true,
  "pushNotifications": false,
  "privacyLevel": "FRIENDS_ONLY",
  "language": "en",
  "currency": "USD",
  "timezone": "UTC"
}
```

## Queue System

### Queue Types

#### BullMQ Queues
1. **trip-queue**: Location enrichment and trip processing
2. **rag-queue**: AI embedding generation for POIs and destinations
3. **photo-queue**: Photo processing, optimization, and moderation
4. **content-moderation-queue**: Content moderation for all user-generated content
5. **weather-queue**: Weather data fetching and caching
6. **notification-queue**: In-app notifications and social interactions
7. **ai-optimization-queue**: AI request optimization and RAG queries

#### RabbitMQ Queues
1. **email-queue**: Email notifications (verification, password reset, etc.)

### Job Types

#### Photo Processing
- `process-photo`: Process uploaded photos
- `optimize-photo`: Optimize photo quality and size
- `moderate-photo-content`: Moderate photo captions

#### Content Moderation
- `moderate-comment`: Moderate user comments
- `moderate-journal-entry`: Moderate journal entries
- `moderate-trip-name`: Moderate trip names
- `moderate-photo-caption`: Moderate photo captions

#### Weather Updates
- `update-weather`: Update weather for specific location
- `update-all-locations-weather`: Bulk weather update

#### Notifications
- `send-notification`: Send individual notification
- `send-social-notification`: Send social interaction notification
- `send-bulk-notification`: Send bulk notifications

#### AI Optimization
- `optimize-ai-request`: Process AI request with cost optimization
- `process-rag-query`: Process RAG queries
- `batch-ai-requests`: Process batch AI requests

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  }
}
```

### Error Codes
- `VALIDATION_ERROR`: Input validation failed
- `AUTHENTICATION_ERROR`: Invalid or missing authentication
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource conflict
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `INTERNAL_SERVER_ERROR`: Server error

## Rate Limiting

### Default Limits
- **Authentication**: 5 requests per minute
- **Photo Upload**: 10 uploads per minute
- **Comments**: 20 comments per minute
- **Likes**: 50 likes per minute
- **AI Requests**: 30 requests per minute

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## File Upload

### Supported Formats
- **Images**: JPEG, PNG, WebP
- **Max Size**: 5MB per file
- **Max Files**: 10 per request

### Storage Providers
1. **AWS S3**: Primary storage
2. **Cloudinary**: Alternative storage with image optimization

### Upload Process
1. File validation (type, size, dimensions)
2. Upload to selected provider
3. Queue for processing and moderation
4. Return optimized URL

## AI Integration

### RAG (Retrieval-Augmented Generation)
- **Embedding Model**: Google Gemini
- **Vector Database**: PostgreSQL with pgvector
- **Context Sources**: POIs, destinations, journal entries
- **Response Generation**: Context-aware travel recommendations

### Cost Optimization
- **Caching**: Redis-based response caching
- **Model Selection**: Automatic model selection based on priority
- **Batch Processing**: Batch similar requests
- **Rate Limiting**: Per-user rate limiting

## WebSocket Real-time Communication

### Connection
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
```json
{
  "type": "message_type",
  "payload": {
    // message specific data
  },
  "timestamp": 1640995200000
}
```

### Event Types

#### Trip Events
- `trip_updated` - Trip details changed
- `itinerary_modified` - Itinerary updated
- `expense_added` - New expense logged
- `budget_updated` - Budget information changed

#### Photo Events
- `photo_uploaded` - New photo added
- `photo_commented` - Comment on photo
- `photo_liked` - Photo liked/reacted to
- `album_updated` - Photo album modified

#### Social Events
- `message_sent` - Chat message
- `notification` - System notification
- `user_joined` - User joined room
- `user_left` - User left room

#### Journal Events
- `journal_entry_created` - New journal entry
- `journal_entry_updated` - Entry modified
- `journal_entry_published` - Entry published
- `journal_comment` - Comment on entry

### Room Management

#### Join Room
```javascript
ws.send(JSON.stringify({
  type: 'join_room',
  payload: {
    roomId: 'trip_123',
    roomType: 'trip'
  }
}));
```

#### Leave Room
```javascript
ws.send(JSON.stringify({
  type: 'leave_room',
  payload: {
    roomId: 'trip_123'
  }
}));
```

### WebSocket Admin Endpoints

#### GET /api/websocket/stats
Get WebSocket server statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "activeConnections": 25,
    "totalRooms": 10,
    "totalMessages": 150,
    "uptime": 3600
  }
}
```

#### GET /api/websocket/rooms/:roomId
Get information about a specific room.

**Response:**
```json
{
  "success": true,
  "data": {
    "roomId": "trip_123",
    "roomType": "trip",
    "participants": ["user1", "user2"],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /api/websocket/clients/:clientId
Get information about a specific client.

**Response:**
```json
{
  "success": true,
  "data": {
    "clientId": "client_123",
    "userId": "user_123",
    "rooms": ["trip_123", "trip_456"],
    "connectedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### POST /api/websocket/broadcast
Broadcast a message to all connected clients (admin only).

**Request Body:**
```json
{
  "message": "Server maintenance in 5 minutes",
  "type": "maintenance_notice",
  "excludeUsers": []
}
```

#### POST /api/websocket/broadcast/room
Broadcast a message to a specific room (admin only).

**Request Body:**
```json
{
  "roomId": "trip_123",
  "message": "Trip itinerary updated",
  "type": "trip_update",
  "excludeUsers": []
}
```

## Environment Variables

### Required Variables
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/trava"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# External APIs
MAPBOX_API_KEY="your-mapbox-key"
OPENWEATHER_API_KEY="your-openweather-key"
GEMINI_API_KEY="your-gemini-key"

# File Storage
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"

CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Email
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email"
SMTP_PASS="your-password"

# RabbitMQ
RABBITMQ_URL="amqp://localhost:5672"
```

### Optional Variables
```bash
# Queue Concurrency
BULLMQ_WORKER_CONCURRENCY="5"
EMAIL_WORKER_CONCURRENCY="5"

# Rate Limiting
RATE_LIMIT_WINDOW_MS="900000"
RATE_LIMIT_MAX_REQUESTS="100"

# Cache TTL
CACHE_TTL="3600"
WEATHER_CACHE_TTL="1800"
```

## Monitoring and Logging

### Log Levels
- **ERROR**: Application errors
- **WARN**: Warning conditions
- **INFO**: General information
- **DEBUG**: Debug information

### Metrics
- Queue job counts and processing times
- API response times and error rates
- Database query performance
- Cache hit/miss ratios
- AI request costs and usage

### Health Checks
- **GET /health**: Basic health check
- **GET /health/detailed**: Detailed system status
- **GET /health/queues**: Queue status and metrics 