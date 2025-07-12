import { Expense, ExpenseCategory, CollaboratorRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '../../services/prisma';
import ApiError from '../../utils/ApiError';
import  logger  from '../../utils/logger';
import { authorizeTripAccess } from '../../middlewares/auth';

import { optimizeAIRequest } from '../../services/ai-cost-optimizer';
import { generateBudgetBreakdown } from '../../services/static-recommendations.service';
import { recommendationService, RecommendationRequest } from '../../services/recommendation.service';
import {CreateExpenseData, UpdateExpenseData, BudgetAnalysis, BudgetOptimizationRequest} from './expense.type'
import { generateBudgetRecommendations, calculateCategoryBreakdown, buildBudgetOptimizationPrompt, parseOptimizationResponse } from './expense.utils'


async function createExpense(data: CreateExpenseData): Promise<Expense> {
    try {
        await authorizeTripAccess(data.tripId, data.userId, [CollaboratorRole.EDITOR]);

    // Validate amount
        if (data.amount <= 0) {
            throw ApiError.BadRequest('Amount must be greater than 0');
        }

        const expense = await prisma.expense.create({
        data: {
            tripId: data.tripId,
            userId: data.userId,
            description: data.description,
            amount: new Decimal(data.amount),
            category: data.category,
            date: data.date,
            },
        });

        logger.info(`Created expense: ${expense.description} for trip: ${data.tripId}`);
        return expense;
    } catch (error) {
        logger.error('Failed to create expense:', error);
        throw ApiError.InternalServerError('Failed to create expense');
    }
}


async function getTripExpenses(tripId: string, userId: string): Promise<Expense[]> {
    await authorizeTripAccess(tripId, userId, [CollaboratorRole.EDITOR, CollaboratorRole.VIEWER]);
    return prisma.expense.findMany({
        where: { tripId },
        orderBy: { date: 'desc' },
    });
}

async function getExpenseSummary(tripId: string, userId: string) {
  await authorizeTripAccess(tripId, userId, [CollaboratorRole.EDITOR, CollaboratorRole.VIEWER]);

  const summary = await prisma.expense.groupBy({
    by: ['category'],
    where: { tripId },
    _sum: {
      amount: true,
    },
    _count: {
      category: true,
    },
  });

  // Format the result to match the original structure if needed
  const formattedSummary = summary.reduce((acc, curr) => {
    const total = curr._sum.amount ?? 0;
    const count = curr._count.category;
    acc[curr.category] = {
      total: new Decimal(total).toNumber(),
      count: count,
      average: count > 0 ? new Decimal(total).div(count).toNumber() : 0,
    };
    return acc;
  }, {} as Record<string, { count: number; total: number; average: number }>);

  return formattedSummary;
}


async function getExpensesByDateRange(tripId: string, userId: string, startDate: Date, endDate: Date): Promise<Expense[]> {
    await authorizeTripAccess(tripId, userId, [CollaboratorRole.EDITOR, CollaboratorRole.VIEWER]);
    return prisma.expense.findMany({
        where: {
            tripId,
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
        orderBy: { date: 'desc' },
    });
}

async function getSpendingTrends(tripId: string, userId: string, startDate: Date, endDate: Date) {
    const expenses = await getExpensesByDateRange(tripId, userId, startDate, endDate);

    const trends = expenses.reduce((acc, expense) => {
    const date = expense.date.toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = 0;
    }
    acc[date] += Number(expense.amount);
    return acc;
  }, {} as Record<string, number>);

  return trends;
}

    
async function getExpensesByCategory(tripId: string, userId: string, category: ExpenseCategory): Promise<Expense[]> {
        await authorizeTripAccess(tripId, userId, [CollaboratorRole.EDITOR, CollaboratorRole.VIEWER]);
        return prisma.expense.findMany({
            where: {
                tripId,
                category,
            },
            orderBy: { date: 'desc' },
        });
}


async function updateExpense(expenseId: string, userId: string, data: UpdateExpenseData): Promise<Expense> {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });

    if (!expense) throw ApiError.NotFound('Expense not found.');

        await authorizeTripAccess(expense.tripId, userId, [CollaboratorRole.EDITOR]);

    // Validate amount if provided
    if (data.amount !== undefined && data.amount <= 0) {
        throw ApiError.BadRequest('Amount must be greater than 0');
    }

    if (data.amount !== undefined && new Decimal(data.amount).equals(expense.amount)) {
        return expense;
    }

    return prisma.expense.update({
        where: { id: expenseId },
        data: {
            ...data,
            amount: data.amount ? new Decimal(data.amount) : undefined,
            date: data.date ? new Date(data.date) : undefined,
        },
    });
}

    
async function deleteExpense(expenseId: string, userId: string): Promise<void> {
    const expense = await prisma.expense.findUnique({ where: { id: expenseId } });
    if (!expense) throw ApiError.NotFound('Expense not found.');

    await authorizeTripAccess(expense.tripId, userId, [CollaboratorRole.EDITOR]);

    await prisma.expense.delete({ where: { id: expenseId } });
}


async function getBudgetAnalysis(tripId: string, userId: string): Promise<BudgetAnalysis> {
    await authorizeTripAccess(tripId, userId, [CollaboratorRole.EDITOR, CollaboratorRole.VIEWER]);
    try {
        const [trip, expenses] = await Promise.all([
            prisma.trip.findUnique({
                where: { id: tripId },
                select: { estimatedBudget: true, startDate: true, endDate: true },
            }),
            prisma.expense.findMany({
                where: { tripId },
                select: { amount: true, category: true, date: true },
            }),
        ]);

        if (!trip) {
            throw ApiError.NotFound('Trip not found');
        }

        const totalBudget = Number(trip.estimatedBudget) || 0;
        const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
        const remainingBudget = totalBudget - totalSpent;
        const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        // Calculate category breakdown
        const categoryBreakdown: Record<string, { amount: number; percentage: number }> = {};
        expenses.forEach(expense => {
            const category = expense.category;
            if (!categoryBreakdown[category]) {
                categoryBreakdown[category] = { amount: 0, percentage: 0 };
            }
            categoryBreakdown[category].amount += Number(expense.amount);
        });

        // Calculate percentages
        Object.keys(categoryBreakdown).forEach(category => {
            categoryBreakdown[category].percentage = totalSpent > 0 
                ? (categoryBreakdown[category].amount / totalSpent) * 100 
                : 0;
        });

        // Calculate daily average and projected total
        const tripDuration = trip.endDate && trip.startDate 
            ? Math.ceil((trip.endDate.getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24))
            : 1;
        
        const daysElapsed = trip.startDate 
            ? Math.ceil((new Date().getTime() - trip.startDate.getTime()) / (1000 * 60 * 60 * 24))
            : 1;
        
        const dailyAverage = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
        const projectedTotal = dailyAverage * tripDuration;

        // Generate recommendations
        const recommendations = generateBudgetRecommendations(
            totalSpent,
            totalBudget,
            categoryBreakdown,
            projectedTotal
        );

        return {
            totalSpent,
            totalBudget,
            remainingBudget,
            spentPercentage,
            categoryBreakdown,
            dailyAverage,
            projectedTotal,
            recommendations,
        };
    } catch (error) {
        logger.error('Failed to get budget analysis:', error);
        throw ApiError.InternalServerError('Failed to get budget analysis');
    }
}

    
async function generateBudgetOptimization(request: BudgetOptimizationRequest) {
    try {
        const { tripId, destinationName, currentBudget, currentExpenses, preferences, startDate, endDate } = request;

        // Get budget breakdown from static recommendations
        const tripDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const staticBreakdown = generateBudgetBreakdown(destinationName, tripDuration, currentBudget);

        // Calculate current spending patterns
        const currentSpending = currentExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
        const currentCategoryBreakdown = calculateCategoryBreakdown(currentExpenses);

        // Generate AI optimization suggestions
        const aiPrompt = buildBudgetOptimizationPrompt(
            destinationName,
            currentBudget,
            currentSpending,
            currentCategoryBreakdown,
            staticBreakdown,
            preferences
        );

        const aiResponse = await optimizeAIRequest({
            prompt: aiPrompt,
            userId: 'system',
            priority: 'medium',
            maxTokens: 800,
            temperature: 0.6,
        });

        const optimizationSuggestions = parseOptimizationResponse(aiResponse);

        logger.info(`Generated budget optimization suggestions for trip: ${tripId}`);
        return {
            currentSpending,
            staticBreakdown,
            currentCategoryBreakdown,
            optimizationSuggestions,
        };
    } catch (error) {
        logger.error('Failed to generate budget optimization:', error);
        throw ApiError.InternalServerError('Failed to generate budget optimization');
    }
}


async function categorizeExpenseWithAI(description: string): Promise<ExpenseCategory> {
    const prompt = `
        Given the following expense description, classify it into one of these categories:
        FOOD, LODGING, TRANSPORT, TICKETS, SHOPPING, MISC.

        Description: "${description}"

        Return only the category name. For example: FOOD
    `;
    try {
        const aiResponse = await optimizeAIRequest({
            prompt,
            userId: 'system-categorizer',
            priority: 'low',
            maxTokens: 15,
            temperature: 0.2,
        });

        // Assuming the AI response is a single category name
        const category = aiResponse.trim().toUpperCase() as ExpenseCategory;

        // Validate that the AI returned a valid category
        if (Object.values(ExpenseCategory).includes(category)) {
            return category;
        }

        logger.warn(`AI returned an invalid expense category: ${aiResponse}`);
        return ExpenseCategory.MISC; // Fallback to MISC
    } catch (error) {
        logger.error('Failed to categorize expense with AI:', error);
        throw ApiError.InternalServerError('Failed to categorize expense');
    }
}


async function getExpenseStats(tripId: string) {
    try {
        const expenses = await prisma.expense.findMany({
            where: { tripId },
            select: {
                amount: true,
                category: true,
                date: true,
            },
        });

        const stats = {
            totalExpenses: expenses.length,
            totalAmount: expenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
            averageExpense: expenses.length > 0 
                ? expenses.reduce((sum, expense) => sum + Number(expense.amount), 0) / expenses.length 
                : 0,
            categories: {} as Record<string, { count: number; total: number }>,
            dailySpending: {} as Record<string, number>,
        };

        // Calculate category stats
        expenses.forEach(expense => {
            const category = expense.category;
            if (!stats.categories[category]) {
                stats.categories[category] = { count: 0, total: 0 };
            }
            stats.categories[category].count++;
            stats.categories[category].total += Number(expense.amount);
        });

        // Calculate daily spending
        expenses.forEach(expense => {
            const date = expense.date.toISOString().split('T')[0];
            stats.dailySpending[date] = (stats.dailySpending[date] || 0) + Number(expense.amount);
        });

        return stats;
    } catch (error) {
        logger.error('Failed to get expense stats:', error);
        throw ApiError.InternalServerError('Failed to get expense stats');
    }
}

    
async function generateSmartBudgetRecommendations(request: RecommendationRequest) {
    try {
        const recommendations = await recommendationService.generateSmartRecommendations(request);
        
        return {
            budget: recommendations.budget,
            insights: recommendations.aiInsights,
            optimizationTips: recommendations.optimizationTips,
            totalEstimatedCost: recommendations.totalEstimatedCost,
            budgetUtilization: recommendations.budgetUtilization,
        };
    } catch (error) {
        logger.error('Failed to generate smart budget recommendations:', error);
        throw ApiError.InternalServerError('Failed to generate budget recommendations');
    }
}

    
async function getPersonalizedBudgetOptimization(
    destinationName: string,
    currentBudget: number,
    currentExpenses: any[],
    preferences?: string[]
) {
    try {
        return await recommendationService.getBudgetOptimization(
            destinationName,
            currentBudget,
            currentExpenses,
            preferences
        );
    } catch (error) {
        logger.error('Failed to get personalized budget optimization:', error);
        return {
            suggestions: ['Consider using public transportation', 'Look for free activities'],
            optimizedBudget: [],
        };
    }
}

    
async function getDestinationBudgetInsights(destinationName: string) {
    try {
        return await recommendationService.getDestinationInsights(destinationName);
    } catch (error) {
        logger.error('Failed to get destination budget insights:', error);
        return ['Research local costs before visiting', 'Book accommodations in advance for better rates'];
    }
}

async function getExpensesByUser(userId: string): Promise<number> {
    const expenses = await prisma.expense.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
    });

    // return tall the amount spent by the user so far
    const totalSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

    return totalSpent;
}

async function getUserExpensesByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
) {
    const expenses = await prisma.expense.findMany({
        where: {
            userId,
            date: {
                gte: startDate,
                lte: endDate,
            },
        },
        orderBy: { date: 'desc' },
    });

    const totalAmountSpent = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    return totalAmountSpent;
}

async function getUserExpensesByCategory(
    userId: string,
    category: ExpenseCategory
) {
    const expenses = await prisma.expense.findMany({
        where: {
            userId,
            category,
        },
        orderBy: { date: 'desc' },
    });

    // return an object with total amount spent per category { category: totalAmount }
    return expenses.reduce((acc, expense) => {
        const category = expense.category;
        const amount = new Decimal(expense.amount).toNumber();
        acc[category] = (acc[category] || 0) + amount;
        return acc;
    }, {} as Record<string, number>);
}


export const expenseService = {
    createExpense,
    updateExpense,
    deleteExpense,
    getTripExpenses,
    getExpenseSummary,
    getExpensesByDateRange,
    getSpendingTrends,
    getExpensesByCategory,
    getBudgetAnalysis,
    generateBudgetOptimization,
    getExpenseStats,
    generateSmartBudgetRecommendations,
    getPersonalizedBudgetOptimization,
    getDestinationBudgetInsights,
    getExpensesByUser,
    getUserExpensesByDateRange,
    getUserExpensesByCategory
};