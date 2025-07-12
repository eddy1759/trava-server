# Trava API Endpoints Documentation

## Base URL
```
http://localhost:4000/api
```

## Authentication
All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Itinerary Endpoints

### Create Itinerary Item
**POST** `/itineraries`
```json
{
  "tripId": "uuid",
  "title": "Visit Eiffel Tower",
  "description": "Iconic landmark with city views",
  "category": "ACTIVITY",
  "startTime": "2024-06-15T09:00:00Z",
  "endTime": "2024-06-15T11:00:00Z",
  "locationId": "uuid (optional)"
}
```

### Get Trip Itinerary
**GET** `/itineraries/trip/:tripId`
Returns all itinerary items for a trip, ordered by start time.

### Get Day Itinerary
**GET** `/itineraries/trip/:tripId/day/:date`
Returns itinerary items for a specific day (date format: ISO string).

### Update Itinerary Item
**PUT** `/itineraries/:itemId`
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "category": "ACTIVITY",
  "startTime": "2024-06-15T10:00:00Z",
  "endTime": "2024-06-15T12:00:00Z"
}
```

### Delete Itinerary Item
**DELETE** `/itineraries/:itemId`

### Generate AI Suggestions
**POST** `/itineraries/suggestions`
```json
{
  "tripId": "uuid",
  "destinationName": "Paris",
  "startDate": "2024-06-15T00:00:00Z",
  "endDate": "2024-06-20T00:00:00Z",
  "budget": 2000,
  "preferences": ["culture", "food", "history"]
}
```

### Get Itinerary Statistics
**GET** `/itineraries/trip/:tripId/stats`
Returns statistics about the trip's itinerary items.

### Bulk Create Items
**POST** `/itineraries/bulk`
```json
{
  "tripId": "uuid",
  "items": [
    {
      "title": "Item 1",
      "category": "ACTIVITY",
      "startTime": "2024-06-15T09:00:00Z"
    }
  ]
}
```

### Reorder Items
**PUT** `/itineraries/trip/:tripId/reorder`
```json
{
  "itemIds": ["uuid1", "uuid2", "uuid3"]
}
```

### Duplicate Item
**POST** `/itineraries/:itemId/duplicate`
Creates a copy of an itinerary item with adjusted timing.

---

## Expense Endpoints

### Create Expense
**POST** `/expenses`
```json
{
  "tripId": "uuid",
  "description": "Hotel booking",
  "amount": 150.00,
  "category": "LODGING",
  "date": "2024-06-15T00:00:00Z"
}
```

### Get Trip Expenses
**GET** `/expenses/trip/:tripId`
Returns all expenses for a trip, ordered by date.

### Get Expenses by Date Range
**GET** `/expenses/trip/:tripId/range?startDate=2024-06-15T00:00:00Z&endDate=2024-06-20T00:00:00Z`

### Get Expenses by Category
**GET** `/expenses/trip/:tripId/category/:category`

### Update Expense
**PUT** `/expenses/:expenseId`
```json
{
  "description": "Updated description",
  "amount": 175.00,
  "category": "LODGING",
  "date": "2024-06-15T00:00:00Z"
}
```

### Delete Expense
**DELETE** `/expenses/:expenseId`

### Get Budget Analysis
**GET** `/expenses/trip/:tripId/budget-analysis`
Returns comprehensive budget analysis including:
- Total spent vs budget
- Category breakdown
- Daily averages
- Projected spending
- Recommendations

### Generate Budget Optimization
**POST** `/expenses/budget-optimization`
```json
{
  "tripId": "uuid",
  "destinationName": "Paris",
  "currentBudget": 2000,
  "currentExpenses": [...],
  "preferences": ["budget-friendly", "local experiences"]
}
```

### Get Expense Statistics
**GET** `/expenses/trip/:tripId/stats`
Returns expense statistics and trends.

### Bulk Create Expenses
**POST** `/expenses/bulk`
```json
{
  "tripId": "uuid",
  "expenses": [
    {
      "description": "Expense 1",
      "amount": 50.00,
      "category": "FOOD",
      "date": "2024-06-15T00:00:00Z"
    }
  ]
}
```

### Get Expense Summary
**GET** `/expenses/trip/:tripId/summary`
Returns expense summary grouped by category.

### Export Expenses (CSV)
**GET** `/expenses/trip/:tripId/export`
Downloads expenses as CSV file.

### Get Spending Trends
**GET** `/expenses/trip/:tripId/trends?days=7`
Returns spending trends over specified number of days.

---

## Data Types

### ItineraryItemCategory
```typescript
enum ItineraryItemCategory {
  ACTIVITY = "ACTIVITY",
  TRANSPORT = "TRANSPORT",
  ACCOMMODATION = "ACCOMMODATION",
  FOOD = "FOOD",
  SHOPPING = "SHOPPING",
  ENTERTAINMENT = "ENTERTAINMENT",
  RELAXATION = "RELAXATION"
}
```

### ExpenseCategory
```typescript
enum ExpenseCategory {
  LODGING = "LODGING",
  FOOD = "FOOD",
  TRANSPORT = "TRANSPORT",
  ACTIVITIES = "ACTIVITIES",
  SHOPPING = "SHOPPING",
  TICKETS = "TICKETS",
  HEALTH = "HEALTH",
  INSURANCE = "INSURANCE",
  OTHER = "OTHER"
}
```

---

## Response Format

All endpoints return responses in this format:
```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}
```

---

## Example Usage

### Creating a Complete Trip with Itinerary and Expenses

1. **Create Trip**
```bash
POST /api/trips
{
  "title": "Paris Adventure",
  "destinationName": "Paris",
  "startDate": "2024-06-15",
  "endDate": "2024-06-20",
  "estimatedBudget": 2000
}
```

2. **Generate Itinerary Suggestions**
```bash
POST /api/itineraries/suggestions
{
  "tripId": "trip-uuid",
  "destinationName": "Paris",
  "startDate": "2024-06-15T00:00:00Z",
  "endDate": "2024-06-20T00:00:00Z",
  "budget": 2000,
  "preferences": ["culture", "food"]
}
```

3. **Add Manual Itinerary Items**
```bash
POST /api/itineraries
{
  "tripId": "trip-uuid",
  "title": "Custom Activity",
  "category": "ACTIVITY",
  "startTime": "2024-06-15T14:00:00Z"
}
```

4. **Log Expenses**
```bash
POST /api/expenses
{
  "tripId": "trip-uuid",
  "description": "Hotel booking",
  "amount": 150,
  "category": "LODGING",
  "date": "2024-06-15T00:00:00Z"
}
```

5. **Check Budget Analysis**
```bash
GET /api/expenses/trip/trip-uuid/budget-analysis
```

6. **Get Optimization Suggestions**
```bash
POST /api/expenses/budget-optimization
{
  "tripId": "trip-uuid",
  "destinationName": "Paris",
  "currentBudget": 2000,
  "currentExpenses": [...]
}
```

---

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Rate Limiting

- 100 requests per minute per IP
- 1000 requests per hour per user

---

## Testing

Use the provided Postman collection: `Trava_API_Collection.json`

Run smoke tests:
```bash
npm run test:smoke
``` 