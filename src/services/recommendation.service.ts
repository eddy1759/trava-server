import { ItineraryItemCategory, ExpenseCategory } from '@prisma/client';
import { getDestinationRecommendations, generateItinerarySuggestions, generateBudgetBreakdown } from './static-recommendations.service';
import { optimizeAIRequest } from './ai-cost-optimizer';
import logger from '../utils/logger';

export interface RecommendationRequest {
  destinationName: string;
  tripDuration: number;
  budget: number;
  preferences?: string[];
  travelStyle?: 'budget' | 'mid-range' | 'luxury';
  interests?: string[];
  groupSize?: number;
}

export interface ItineraryRecommendation {
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

export interface BudgetRecommendation {
  category: ExpenseCategory;
  description: string;
  estimatedAmount: number;
  currency: string;
  frequency: 'daily' | 'once' | 'per_activity';
  tips: string[];
  source: 'static' | 'ai';
}

export interface SmartRecommendationResponse {
  itinerary: ItineraryRecommendation[];
  budget: BudgetRecommendation[];
  aiInsights: string[];
  optimizationTips: string[];
  totalEstimatedCost: number;
  budgetUtilization: number;
}

class RecommendationService {
  /**
   * Generate comprehensive recommendations combining static and AI data
   */
  async generateSmartRecommendations(request: RecommendationRequest): Promise<SmartRecommendationResponse> {
    try {
      const { destinationName, tripDuration, budget, preferences, travelStyle, interests, groupSize } = request;

      // Get static recommendations as base
      const staticRecommendations = getDestinationRecommendations(destinationName, tripDuration, budget);
      
      // Generate AI-enhanced recommendations
      const aiRecommendations = await this.generateAIRecommendations(request);
      
      // Combine and optimize recommendations
      const combinedRecommendations = this.combineRecommendations(
        staticRecommendations,
        aiRecommendations,
        request
      );

      // Calculate budget utilization and generate insights
      const totalCost = this.calculateTotalCost(combinedRecommendations.itinerary, combinedRecommendations.budget, tripDuration);
      const budgetUtilization = (totalCost / budget) * 100;

      // Generate optimization tips
      const optimizationTips = this.generateOptimizationTips(
        combinedRecommendations,
        budget,
        totalCost,
        travelStyle,
        groupSize
      );

      return {
        itinerary: combinedRecommendations.itinerary,
        budget: combinedRecommendations.budget,
        aiInsights: aiRecommendations.insights,
        optimizationTips,
        totalEstimatedCost: totalCost,
        budgetUtilization,
      };
    } catch (error) {
      logger.error('Failed to generate smart recommendations:', error);
      // Fallback to static recommendations only
      return this.generateFallbackRecommendations(request);
    }
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateAIRecommendations(request: RecommendationRequest) {
    const { destinationName, tripDuration, budget, preferences, travelStyle, interests, groupSize } = request;

    const aiPrompt = this.buildAIRecommendationPrompt(request);
    
    try {
      const aiResponse = await optimizeAIRequest({
        prompt: aiPrompt,
        userId: 'system',
        priority: 'medium',
        maxTokens: 1500,
        temperature: 0.7,
      });

      return this.parseAIRecommendations(aiResponse);
    } catch (error) {
      logger.error('AI recommendation generation failed, using fallback:', error);
      return {
        activities: [],
        budget: [],
        insights: ['Using static recommendations due to AI service unavailability'],
      };
    }
  }

  /**
   * Build AI prompt for recommendations
   */
  private buildAIRecommendationPrompt(request: RecommendationRequest): string {
    const { destinationName, tripDuration, budget, preferences, travelStyle, interests, groupSize } = request;
    
    const preferencesText = preferences?.length ? `Preferences: ${preferences.join(', ')}. ` : '';
    const interestsText = interests?.length ? `Interests: ${interests.join(', ')}. ` : '';
    const styleText = travelStyle ? `Travel style: ${travelStyle}. ` : '';
    const groupText = groupSize ? `Group size: ${groupSize} people. ` : '';

    return `Generate personalized travel recommendations for ${destinationName} for a ${tripDuration}-day trip with a budget of $${budget}. ${preferencesText}${interestsText}${styleText}${groupText}

Provide recommendations in this JSON format:
{
  "activities": [
    {
      "title": "Activity name",
      "description": "Brief description",
      "category": "ACTIVITY|TRANSPORT|ACCOMMODATION|FOOD|SHOPPING|ENTERTAINMENT|RELAXATION",
      "estimatedCost": 50,
      "duration": 3,
      "bestTime": "Morning/Afternoon/Evening",
      "tips": ["Tip 1", "Tip 2"],
      "priority": "must-see|recommended|optional"
    }
  ],
  "budget": [
    {
      "category": "LODGING|FOOD|TRANSPORT|ACTIVITIES|SHOPPING|TICKETS|HEALTH|INSURANCE|OTHER",
      "description": "Budget item description",
      "estimatedAmount": 100,
      "currency": "USD",
      "frequency": "daily|once|per_activity",
      "tips": ["Budget tip 1", "Budget tip 2"]
    }
  ],
  "insights": [
    "Insightful tip about the destination",
    "Local recommendation",
    "Cost-saving advice"
  ]
}

Focus on unique, local experiences and cost-effective options that match the specified preferences and budget.`;
  }

  /**
   * Parse AI response into structured recommendations
   */
  private parseAIRecommendations(aiResponse: string): any {
    try {
      // Try to extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      logger.warn('Failed to parse AI response as JSON:', aiResponse);
      return {
        activities: [],
        budget: [],
        insights: ['Unable to parse AI recommendations'],
      };
    } catch (error) {
      logger.error('Error parsing AI recommendations:', error);
      return {
        activities: [],
        budget: [],
        insights: ['Error processing AI recommendations'],
      };
    }
  }

  /**
   * Combine static and AI recommendations
   */
  private combineRecommendations(
    staticRecs: any,
    aiRecs: any,
    request: RecommendationRequest
  ): { itinerary: ItineraryRecommendation[], budget: BudgetRecommendation[] } {
    const { travelStyle, groupSize } = request;

    // Process static activities
    const staticActivities: ItineraryRecommendation[] = staticRecs.activities.map((activity: any) => ({
      ...activity,
      source: 'static' as const,
      priority: this.determinePriority(activity, travelStyle),
    }));

    // Process AI activities
    const aiActivities: ItineraryRecommendation[] = (aiRecs.activities || []).map((activity: any) => ({
      ...activity,
      source: 'ai' as const,
      priority: activity.priority || 'recommended',
    }));

    // Combine and deduplicate activities
    const combinedActivities = this.deduplicateActivities([...staticActivities, ...aiActivities]);

    // Process budget recommendations
    const staticBudget: BudgetRecommendation[] = staticRecs.expenses.map((expense: any) => ({
      ...expense,
      source: 'static' as const,
      tips: this.generateBudgetTips(expense, travelStyle, groupSize),
    }));

    const aiBudget: BudgetRecommendation[] = (aiRecs.budget || []).map((budget: any) => ({
      ...budget,
      source: 'ai' as const,
      tips: budget.tips || [],
    }));

    // Combine budget recommendations
    const combinedBudget = this.combineBudgetRecommendations(staticBudget, aiBudget);

    return {
      itinerary: combinedActivities,
      budget: combinedBudget,
    };
  }

  /**
   * Determine activity priority based on travel style
   */
  private determinePriority(activity: any, travelStyle?: string): 'must-see' | 'recommended' | 'optional' {
    if (travelStyle === 'luxury' && activity.estimatedCost > 100) {
      return 'must-see';
    }
    if (travelStyle === 'budget' && activity.estimatedCost === 0) {
      return 'must-see';
    }
    return 'recommended';
  }

  /**
   * Generate budget tips based on travel style and group size
   */
  private generateBudgetTips(expense: any, travelStyle?: string, groupSize?: number): string[] {
    const tips: string[] = [];

    if (travelStyle === 'budget') {
      tips.push('Look for discounts and deals');
      if (expense.category === 'LODGING') {
        tips.push('Consider hostels or budget accommodations');
      }
    }

    if (groupSize && groupSize > 4) {
      tips.push('Group discounts may be available');
      if (expense.category === 'TRANSPORT') {
        tips.push('Consider group transportation passes');
      }
    }

    return tips;
  }

  /**
   * Deduplicate activities based on title similarity
   */
  private deduplicateActivities(activities: ItineraryRecommendation[]): ItineraryRecommendation[] {
    const seen = new Set<string>();
    return activities.filter(activity => {
      const key = activity.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Combine budget recommendations
   */
  private combineBudgetRecommendations(
    staticBudget: BudgetRecommendation[],
    aiBudget: BudgetRecommendation[]
  ): BudgetRecommendation[] {
    const combined = [...staticBudget];
    
    // Add AI budget items that don't conflict with static ones
    aiBudget.forEach(aiItem => {
      const conflict = staticBudget.find(staticItem => 
        staticItem.category === aiItem.category && 
        staticItem.frequency === aiItem.frequency
      );
      
      if (!conflict) {
        combined.push(aiItem);
      }
    });

    return combined;
  }

  /**
   * Calculate total estimated cost
   */
  private calculateTotalCost(
    itinerary: ItineraryRecommendation[],
    budget: BudgetRecommendation[],
    tripDuration: number
  ): number {
    const activityCost = itinerary.reduce((sum, activity) => sum + activity.estimatedCost, 0);
    
    const budgetCost = budget.reduce((sum, item) => {
      if (item.frequency === 'daily') {
        return sum + (item.estimatedAmount * tripDuration);
      } else if (item.frequency === 'per_activity') {
        return sum + (item.estimatedAmount * itinerary.length);
      } else {
        return sum + item.estimatedAmount;
      }
    }, 0);

    return activityCost + budgetCost;
  }

  /**
   * Generate optimization tips
   */
  private generateOptimizationTips(
    recommendations: any,
    budget: number,
    totalCost: number,
    travelStyle?: string,
    groupSize?: number
  ): string[] {
    const tips: string[] = [];

    if (totalCost > budget) {
      tips.push('💡 Consider reducing activities or finding budget alternatives');
      tips.push('💰 Look for free activities and local experiences');
      tips.push('🏨 Consider alternative accommodations like hostels or vacation rentals');
    }

    if (travelStyle === 'budget') {
      tips.push('🍽️ Eat at local markets and street food for authentic, affordable meals');
      tips.push('🚇 Use public transportation instead of taxis');
      tips.push('🎫 Look for city passes that bundle multiple attractions');
    }

    if (groupSize && groupSize > 2) {
      tips.push('👥 Book group activities for better rates');
      tips.push('🏠 Consider vacation rentals for group accommodation');
    }

    if (totalCost < budget * 0.7) {
      tips.push('✅ Great budget planning! You have room for additional experiences');
    }

    return tips;
  }

  /**
   * Generate fallback recommendations using only static data
   */
  private generateFallbackRecommendations(request: RecommendationRequest): SmartRecommendationResponse {
    const { destinationName, tripDuration, budget } = request;
    
    const staticRecs = getDestinationRecommendations(destinationName, tripDuration, budget);
    const totalCost = this.calculateTotalCost(
      staticRecs.activities.map(a => ({ ...a, source: 'static', priority: 'recommended' })),
      staticRecs.expenses.map(e => ({ ...e, source: 'static', tips: [] })),
      tripDuration
    );

    return {
      itinerary: staticRecs.activities.map(activity => ({
        ...activity,
        source: 'static' as const,
        priority: 'recommended' as const,
      })),
      budget: staticRecs.expenses.map(expense => ({
        ...expense,
        source: 'static' as const,
        tips: [],
      })),
      aiInsights: ['Using static recommendations due to AI service unavailability'],
      optimizationTips: ['Consider booking in advance for better rates'],
      totalEstimatedCost: totalCost,
      budgetUtilization: (totalCost / budget) * 100,
    };
  }

  /**
   * Get destination-specific insights
   */
  async getDestinationInsights(destinationName: string): Promise<string[]> {
    try {
      const prompt = `Provide 3-5 unique insights about ${destinationName} that would help travelers:
- Best times to visit
- Local customs or etiquette
- Hidden gems or off-the-beaten-path spots
- Cost-saving tips specific to this destination
- Cultural highlights

Format as a simple list.`;

      const response = await optimizeAIRequest({
        prompt,
        userId: 'system',
        priority: 'low',
        maxTokens: 500,
        temperature: 0.6,
      });

      return response.split('\n').filter(line => line.trim().length > 0);
    } catch (error) {
      logger.error('Failed to get destination insights:', error);
      return [
        'Research local customs before visiting',
        'Book popular attractions in advance',
        'Try local cuisine for authentic experiences',
      ];
    }
  }

  /**
   * Get personalized budget optimization
   */
  async getBudgetOptimization(
    destinationName: string,
    currentBudget: number,
    currentExpenses: any[],
    preferences?: string[]
  ): Promise<{ suggestions: string[], optimizedBudget: any[] }> {
    try {
      const prompt = `Provide budget optimization suggestions for ${destinationName} with a budget of $${currentBudget}. ${preferences?.length ? `Preferences: ${preferences.join(', ')}.` : ''}

Current spending pattern: ${JSON.stringify(currentExpenses)}

Provide 5 specific, actionable suggestions to optimize spending while maintaining trip quality. Focus on:
- Category-specific savings
- Alternative options
- Timing and booking strategies
- Local cost-saving opportunities

Format as a numbered list.`;

      const response = await optimizeAIRequest({
        prompt,
        userId: 'system',
        priority: 'medium',
        maxTokens: 800,
        temperature: 0.5,
      });

      const suggestions = response.split('\n').filter(line => line.trim().match(/^\d+\./));

      return {
        suggestions,
        optimizedBudget: [], // Could be enhanced to provide specific budget adjustments
      };
    } catch (error) {
      logger.error('Failed to get budget optimization:', error);
      return {
        suggestions: ['Consider using public transportation', 'Look for free activities', 'Eat at local markets'],
        optimizedBudget: [],
      };
    }
  }
}

export const recommendationService = new RecommendationService(); 