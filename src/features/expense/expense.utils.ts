import logger from "../../utils/logger";

function generateBudgetRecommendations(
    totalSpent: number,
    totalBudget: number,
    categoryBreakdown: Record<string, { amount: number; percentage: number }>,
    projectedTotal: number
): string[] {
    const recommendations: string[] = [];

    // Check if over budget
    if (totalSpent > totalBudget) {
        recommendations.push('⚠️ You are currently over budget. Consider reducing expenses in high-spending categories.');
    }

    // Check if projected spending exceeds budget
    if (projectedTotal > totalBudget * 1.1) {
        recommendations.push('📊 At current spending rate, you may exceed your budget by 10% or more.');
    }

    // Category-specific recommendations
    const highSpendingCategories = Object.entries(categoryBreakdown)
        .filter(([_, data]) => data.percentage > 40)
        .map(([category, _]) => category);

    if (highSpendingCategories.length > 0) {
        recommendations.push(`💰 Consider reducing spending in: ${highSpendingCategories.join(', ')}`);
    }

    // Positive reinforcement
    if (totalSpent < totalBudget * 0.7) {
        recommendations.push('✅ Great job staying under budget! You have room for additional activities.');
    }

    return recommendations;
}


function calculateCategoryBreakdown(expenses: any[]): Record<string, { amount: number; percentage: number }> {
    const breakdown: Record<string, { amount: number; percentage: number }> = {};
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

    expenses.forEach(expense => {
        const category = expense.category;
        if (!breakdown[category]) {
            breakdown[category] = { amount: 0, percentage: 0 };
        }
        breakdown[category].amount += Number(expense.amount);
    });

    Object.keys(breakdown).forEach(category => {
        breakdown[category].percentage = total > 0 
            ? (breakdown[category].amount / total) * 100 
            : 0;
    });

    return breakdown;
}

function buildBudgetOptimizationPrompt(
    destinationName: string,
    currentBudget: number,
    currentSpending: number,
    currentCategoryBreakdown: Record<string, any>,
    staticBreakdown: any[],
    preferences: string[] = []
): string {
    const preferencesText = preferences.length > 0 ? `Preferences: ${preferences.join(', ')}. ` : '';

    const prompt = `
        Provide budget optimization advice for a trip to ${destinationName} with a budget of $${currentBudget}. ${preferencesText}

        Current spending: $${currentSpending}
        Current category breakdown: ${JSON.stringify(currentCategoryBreakdown)}

        Recommended budget breakdown: ${JSON.stringify(staticBreakdown)}

        Provide 3-5 specific, actionable suggestions to optimize spending while maintaining trip quality. Focus on:
        - Category-specific savings tips
        - Alternative options for expensive activities
        - Timing and booking strategies
        - Local cost-saving opportunities

        Format as a simple list of recommendations.
    `
    
    return prompt;
}

function parseOptimizationResponse(aiResponse: string): string[] {
    try {
        // Extract bullet points or numbered items
        const suggestions = aiResponse
            .split('\n')
            .filter(line => line.trim().match(/^[•\-\*\d]+\.?\s+/))
            .map(line => line.replace(/^[•\-\*\d]+\.?\s+/, '').trim())
            .filter(suggestion => suggestion.length > 10);

        return suggestions.length > 0 ? suggestions : [aiResponse];
    } catch (error) {
        logger.error('Error parsing optimization response:', error);
        return [aiResponse];
    }
}

export {
    generateBudgetRecommendations,
    calculateCategoryBreakdown,
    buildBudgetOptimizationPrompt,
    parseOptimizationResponse
}
