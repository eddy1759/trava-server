import { z } from 'zod';
import { ExpenseCategory } from '@prisma/client';

const createExpenseSchema = z.object({
  tripId: z.string().uuid(),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.number().positive('Amount must be positive'),
  category: z.nativeEnum(ExpenseCategory),
  date: z.string().datetime(),
});


const updateExpenseSchema = z.object({
  description: z.string().min(1).max(500).optional(),
  amount: z.number().positive().optional(),
  category: z.nativeEnum(ExpenseCategory).optional(),
  date: z.string().datetime().optional(),
});


const budgetOptimizationSchema = z.object({
  tripId: z.string().uuid(),
  destinationName: z.string().min(1),
  currentBudget: z.number().positive(),
  currentExpenses: z.array(z.any()),
  preferences: z.array(z.string()).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
});

const smartBudgetRecommendationsSchema = z.object({
  destinationName: z.string().min(1),
  tripDuration: z.number().positive(),
  budget: z.number().positive(),
  preferences: z.array(z.string()).optional(),
  travelStyle: z.enum(['budget', 'mid-range', 'luxury']).optional(),
  interests: z.array(z.string()).optional(),
  groupSize: z.number().positive().optional(),
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

export const expenseValidationSchema = {
  createExpenseSchema,
  updateExpenseSchema,
  budgetOptimizationSchema,
  smartBudgetRecommendationsSchema,
  dateRangeSchema
}