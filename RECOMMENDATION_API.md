# Trava Recommendation API Documentation

## Overview

The Recommendation API provides intelligent suggestions for itinerary planning and budget optimization by combining static destination data with AI-powered insights. This service integrates with the existing itinerary and expense management systems to provide personalized travel recommendations.

## Base URL
```
/api/recommendations
```

## Authentication
All endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Generate Smart Recommendations

**POST** `/api/recommendations`

Generate comprehensive recommendations combining static and AI data for both itinerary and budget planning.

#### Request Body
```json
{
  "destinationName": "Paris",
  "tripDuration": 7,
  "budget": 2000,
  "preferences": ["culture", "food", "art"],
  "travelStyle": "mid-range",
  "interests": ["museums", "architecture", "cuisine"],
  "groupSize": 2
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "itinerary": [
      {
        "title": "Visit the Eiffel Tower",
        "description": "Iconic symbol of Paris with stunning city views",
        "category": "ACTIVITY",
        "estimatedCost": 30,
        "duration": 3,
        "bestTime": "Early morning or sunset",
        "tips": ["Book tickets online to avoid queues", "Visit at sunset for best photos"],
        "source": "static",
        "priority": "must-see"
      }
    ],
    "budget": [
      {
        "category": "LODGING",
        "description": "Hotel in central Paris",
        "estimatedAmount": 150,
        "currency": "EUR",
        "frequency": "daily",
        "tips": ["Look for discounts and deals", "Consider hostels or budget accommodations"],
        "source": "static"
      }
    ],
    "aiInsights": [
      "Visit museums on first Sunday of month for free entry",
      "Try local markets for authentic food experiences"
    ],
    "optimizationTips": [
      "💡 Consider reducing activities or finding budget alternatives",
      "🍽️ Eat at local markets and street food for authentic, affordable meals"
    ],
    "totalEstimatedCost": 1850,
    "budgetUtilization": 92.5
  }
}
```

### 2. Get Destination Insights

**GET** `/api/recommendations/insights/:destinationName`

Get destination-specific insights and tips for travel planning.

#### Response
```json
{
  "success": true,
  "data": {
    "destination": "Paris",
    "insights": [
      "Best time to visit is April-June or September-October",
      "Learn basic French phrases for better local interaction",
      "Use the Paris Pass for discounted museum access",
      "Visit Montmartre early morning to avoid crowds"
    ]
  }
}
```

### 3. Get Budget Optimization

**POST** `/api/recommendations/budget-optimization`

Get personalized budget optimization suggestions based on current spending patterns.

#### Request Body
```json
{
  "destinationName": "Paris",
  "currentBudget": 2000,
  "currentExpenses": [
    {
      "category": "LODGING",
      "amount": 800
    },
    {
      "category": "FOOD",
      "amount": 300
    }
  ],
  "preferences": ["budget-friendly", "local experiences"]
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "1. Consider staying in arrondissements 11-20 for better rates",
      "2. Use the Navigo pass for unlimited public transport",
      "3. Eat at local markets and bakeries instead of restaurants",
      "4. Visit free museums on first Sunday of month",
      "5. Book activities in advance for better prices"
    ],
    "optimizedBudget": []
  }
}
```

### 4. Get Static Recommendations

**GET** `/api/recommendations/static/:destinationName?tripDuration=7&budget=1000`

Get static recommendations for a destination without AI enhancement.

#### Query Parameters
- `tripDuration` (optional): Number of days (default: 7)
- `budget` (optional): Budget amount (default: 1000)

#### Response
```json
{
  "success": true,
  "data": {
    "destination": "Paris",
    "recommendations": {
      "itinerary": [
        {
          "title": "Visit the Louvre Museum",
          "description": "World's largest art museum with famous masterpieces",
          "category": "ACTIVITY",
          "estimatedCost": 17,
          "duration": 4,
          "bestTime": "Wednesday and Friday evenings (less crowded)",
          "tips": ["Free entry on first Sunday of month", "Start with the Mona Lisa"],
          "source": "static",
          "priority": "recommended"
        }
      ],
      "budget": [
        {
          "category": "FOOD",
          "description": "Meals and dining",
          "estimatedAmount": 60,
          "currency": "EUR",
          "frequency": "daily",
          "tips": [],
          "source": "static"
        }
      ],
      "totalEstimatedCost": 1200,
      "budgetUtilization": 120
    }
  }
}
```

### 5. Get AI-Only Recommendations

**POST** `/api/recommendations/ai`

Get AI-powered recommendations only, without static data.

#### Request Body
```json
{
  "destinationName": "Tokyo",
  "tripDuration": 5,
  "budget": 1500,
  "preferences": ["technology", "anime", "food"],
  "travelStyle": "budget",
  "interests": ["gaming", "manga", "sushi"],
  "groupSize": 1
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "destination": "Tokyo",
    "insights": [
      "Visit Akihabara for electronics and anime culture",
      "Try conveyor belt sushi for affordable dining",
      "Use the JR Pass for cost-effective transportation"
    ],
    "budgetOptimization": {
      "suggestions": [
        "1. Stay in capsule hotels for unique budget experience",
        "2. Use convenience stores for affordable meals",
        "3. Visit free observation decks instead of paid ones"
      ],
      "optimizedBudget": []
    },
    "aiGenerated": true
  }
}
```

## Integration with Existing Services

### Itinerary Service Integration

The recommendation service is integrated with the itinerary service through additional endpoints:

#### Smart Itinerary Recommendations
**POST** `/api/itineraries/smart-recommendations`

#### Destination Insights for Itinerary
**GET** `/api/itineraries/insights/:destinationName`

#### Budget Optimization for Itinerary
**POST** `/api/itineraries/budget-optimization`

### Expense Service Integration

The recommendation service is integrated with the expense service through additional endpoints:

#### Smart Budget Recommendations
**POST** `/api/expenses/smart-recommendations`

#### Personalized Budget Optimization
**POST** `/api/expenses/personalized-optimization`

#### Destination Budget Insights
**GET** `/api/expenses/insights/:destinationName`

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Missing required fields: destinationName, tripDuration, budget"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Authentication required"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to generate recommendations"
}
```

## Data Models

### RecommendationRequest
```typescript
interface RecommendationRequest {
  destinationName: string;
  tripDuration: number;
  budget: number;
  preferences?: string[];
  travelStyle?: 'budget' | 'mid-range' | 'luxury';
  interests?: string[];
  groupSize?: number;
}
```

### ItineraryRecommendation
```typescript
interface ItineraryRecommendation {
  title: string;
  description: string;
  category: ItineraryItemCategory;
  estimatedCost: number;
  duration: number;
  bestTime: string;
  tips: string[];
  source: 'static' | 'ai';
  priority: 'must-see' | 'recommended' | 'optional';
}
```

### BudgetRecommendation
```typescript
interface BudgetRecommendation {
  category: ExpenseCategory;
  description: string;
  estimatedAmount: number;
  currency: string;
  frequency: 'daily' | 'once' | 'per_activity';
  tips: string[];
  source: 'static' | 'ai';
}
```

### SmartRecommendationResponse
```typescript
interface SmartRecommendationResponse {
  itinerary: ItineraryRecommendation[];
  budget: BudgetRecommendation[];
  aiInsights: string[];
  optimizationTips: string[];
  totalEstimatedCost: number;
  budgetUtilization: number;
}
```

## Features

### Smart Recommendation Engine
- Combines static destination data with AI-powered insights
- Provides personalized recommendations based on preferences
- Includes budget optimization and cost-saving tips
- Fallback to static recommendations when AI is unavailable

### Destination Insights
- Local customs and etiquette tips
- Best times to visit
- Hidden gems and off-the-beaten-path spots
- Cost-saving strategies specific to each destination

### Budget Optimization
- Personalized spending recommendations
- Category-specific savings tips
- Alternative options for expensive activities
- Timing and booking strategies

### Integration Benefits
- Seamless integration with existing itinerary and expense services
- Consistent API patterns and error handling
- Authentication and authorization built-in
- Comprehensive logging and monitoring

## Usage Examples

### Frontend Integration Example

```javascript
// Generate smart recommendations for a trip
const getRecommendations = async (tripData) => {
  const response = await fetch('/api/recommendations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      destinationName: tripData.destination,
      tripDuration: tripData.duration,
      budget: tripData.budget,
      preferences: tripData.preferences,
      travelStyle: tripData.style
    })
  });
  
  const data = await response.json();
  return data.data;
};

// Get destination insights
const getInsights = async (destination) => {
  const response = await fetch(`/api/recommendations/insights/${destination}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const data = await response.json();
  return data.data.insights;
};
```

### Budget Planning Example

```javascript
// Get budget optimization for current trip
const getBudgetOptimization = async (tripData, currentExpenses) => {
  const response = await fetch('/api/recommendations/budget-optimization', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      destinationName: tripData.destination,
      currentBudget: tripData.budget,
      currentExpenses: currentExpenses,
      preferences: tripData.preferences
    })
  });
  
  const data = await response.json();
  return data.data.suggestions;
};
```

## Performance Considerations

- AI requests are cached to reduce costs and improve response times
- Static recommendations are served immediately without AI dependency
- Fallback mechanisms ensure service availability even when AI is down
- Rate limiting prevents abuse of AI services
- Batch processing for multiple recommendations

## Security

- All endpoints require authentication
- Input validation prevents injection attacks
- Rate limiting protects against abuse
- Sensitive data is not logged
- AI requests are sanitized and validated

## Monitoring and Logging

- All recommendation requests are logged with user context
- AI service failures are tracked and monitored
- Performance metrics are collected for optimization
- Error rates and response times are monitored
- Cache hit rates are tracked for cost optimization 