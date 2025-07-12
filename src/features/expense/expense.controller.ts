import { Request, Response } from 'express';
import { ExpenseCategory } from '@prisma/client';
import { StatusCodes } from 'http-status-codes';
import logger from '../../utils/logger';
import { asyncWrapper } from '../../utils/asyncWrapper';
import { expenseService } from './expense.service';
import { expenseValidationSchema } from './expense.validation'



const createExpense = asyncWrapper(async (req: Request, res: Response) => {
  const validatedData = expenseValidationSchema.createExpenseSchema.parse(req.body);
  
  const expense = await expenseService.createExpense({
      tripId: validatedData.tripId,
      userId: req.user?.id,
      description: validatedData.description,
      amount: validatedData.amount,
      category: validatedData.category,
      date: new Date(validatedData.date),
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: "Expense created successfully",
    data: expense,
  });
});


const getTripExpenses = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const userId = req.user?.id;
  
  if (!tripId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID is required',
    });
  }

  const expenses = await expenseService.getTripExpenses(tripId, userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Trip expenses fetched successfully",
    data: expenses,
  });
});


const getExpensesByDateRange = asyncWrapper(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const userId = req.user?.id;

    // We get startDate and endDate from the query string
    const validatedData = expenseValidationSchema.dateRangeSchema.parse(req.query);

    if (!tripId) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            success: false,
            message: 'Trip ID is required',
        });
    }
    if (!userId) {
        return res.status(StatusCodes.UNAUTHORIZED).json({
            success: false,
            message: 'User not authenticated',
        });
    }

    const expenses = await expenseService.getExpensesByDateRange(
        tripId,
        userId,
        new Date(validatedData.startDate),
        new Date(validatedData.endDate)
    );

    res.status(StatusCodes.OK).json({
        success: true,
        message: `Expenses from ${validatedData.startDate} to ${validatedData.endDate} fetched successfully`,
        data: expenses,
    });
});


const getExpensesByCategory = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId, category } = req.params;
  const userId = req.user?.id;

  if (!tripId || !category) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID and category are required',
    });
  }

  const expenses = await expenseService.getExpensesByCategory(tripId, userId, category as ExpenseCategory);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `${category} expenses fetched successfully`,
    data: expenses,
  });
});


const updateExpense = asyncWrapper(async (req: Request, res: Response) => {
  const { expenseId } = req.params;
  const validatedData = expenseValidationSchema.updateExpenseSchema.parse(req.body);
  const userId = req.user?.id || 'system';
  
  if (!expenseId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Expense ID is required',
    });
  }

  const updatedData: any = { ...validatedData };
  if (validatedData.date) {
    updatedData.date = new Date(validatedData.date);
  }

  const expense = await expenseService.updateExpense(expenseId, userId, updatedData);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Expenses updated successfully",
    data: expense,
  });
});


const deleteExpense = asyncWrapper(async (req: Request, res: Response) => {
  const { expenseId } = req.params;
  const userId = req.user?.id;
  
  if (!expenseId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Expense ID is required',
    });
  }

  await expenseService.deleteExpense(expenseId, userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Expense deleted successfully',
  });
});


const getBudgetAnalysis = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const userId = req.user?.id;

  if (!tripId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID is required',
    });
  }

  const analysis = await expenseService.getBudgetAnalysis(tripId, userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Budget Analysis fetched successfully",
    data: analysis,
  });
});



const generateBudgetOptimization = asyncWrapper(async (req: Request, res: Response) => {
  const validatedData = expenseValidationSchema.budgetOptimizationSchema.parse(req.body);
  
  const optimization = await expenseService.generateBudgetOptimization({
    tripId: validatedData.tripId,
    destinationName: validatedData.destinationName,
    currentBudget: validatedData.currentBudget,
    currentExpenses: validatedData.currentExpenses,
    preferences: validatedData.preferences,
    startDate: validatedData.startDate,
    endDate: validatedData.endDate
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Budget optimised successfully",
    data: optimization,
  });
});



const getExpenseStats = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  
  if (!tripId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID is required',
    });
  }

  const stats = await expenseService.getExpenseStats(tripId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Trip expense statistics fetched successfully",
    data: stats,
  });
});


const bulkCreateExpenses = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId, expenses } = req.body;
  
  if (!tripId || !Array.isArray(expenses)) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID and expenses array are required',
    });
  }

  const createdExpenses = [];
  const errors = [];

  for (const expense of expenses) {
    try {
      const validatedExpense = expenseValidationSchema.createExpenseSchema.parse({
          ...expense,
          tripId,
      });

      const createdExpense = await expenseService.createExpense({
        tripId: validatedExpense.tripId,
        userId: req.user?.id,
        description: validatedExpense.description,
        amount: validatedExpense.amount,
        category: validatedExpense.category,
        date: new Date(validatedExpense.date),
      });

      createdExpenses.push(createdExpense);
    } catch (error) {
      logger.error(`Failed to create expense: ${expense.description}`, error);
      errors.push({
        expense: expense.description,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  res.status(StatusCodes.CREATED).json({
    success: true,
     message: `Created ${createdExpenses.length} expenses, ${errors.length} failed`,
    data: {
      created: createdExpenses,
    }
  });
});



const getExpenseSummary = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const userId = req.user?.id;

  const summary = await expenseService.getExpenseSummary(tripId, userId)
  
  
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Trip expense summary fetched successfully",
    data: summary,
  });
});


const exportExpenses = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const userId = req.user?.id;
  
  if (!tripId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Trip ID is required',
    });
  }

  const expenses = await expenseService.getTripExpenses(tripId, userId);
  
  // Generate CSV content
  const csvHeaders = 'Date,Description,Category,Amount\n';
  const csvRows = expenses.map(expense => 
    `${expense.date.toISOString().split('T')[0]},"${expense.description}",${expense.category},${expense.amount}`
  ).join('\n');
  
  const csvContent = csvHeaders + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="expenses-${tripId}.csv"`);
  res.status(StatusCodes.OK).send(csvContent);
});



const getSpendingTrends = asyncWrapper(async (req: Request, res: Response) => {
  const { tripId } = req.params;
  const userId = req.user?.id;

  const { startDate, endDate } = req.query;

  if (typeof startDate !== 'string' || typeof endDate !== 'string') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'startDate and endDate query parameters are required.',
    });
  }

  const trends = await expenseService.getSpendingTrends(tripId, userId, new Date(startDate), new Date(endDate));

  // convert startdate to enddate to days so we can use in the return message, as the message should be spending trends for this days successfully fetched
  const startDateObj = new Date(startDate);
  const endDateObj = new Date(endDate);
  const startDateFormatted = startDateObj.toISOString().split('T')[0];
  const endDateFormatted = endDateObj.toISOString().split('T')[0];

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Spending trends for ${startDateFormatted} to ${endDateFormatted} fetched successfully`,
    data: trends,
  });
});


const generateSmartBudgetRecommendations = asyncWrapper(async (req: Request, res: Response) => {
  const validatedData = expenseValidationSchema.smartBudgetRecommendationsSchema.parse(req.body);
  
  const recommendations = await expenseService.generateSmartBudgetRecommendations({
    destinationName: validatedData.destinationName,
    tripDuration: validatedData.tripDuration,
    budget: validatedData.budget,
    preferences: validatedData.preferences,
    travelStyle: validatedData.travelStyle,
    interests: validatedData.interests,
    groupSize: validatedData.groupSize,
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Smart budget recommendations generated successfully",
    data: recommendations,
  });
});



const getPersonalizedBudgetOptimization = asyncWrapper(async (req: Request, res: Response) => {
  const { destinationName, currentBudget, currentExpenses, preferences } = req.body;
  
  if (!destinationName || !currentBudget) {
    return res.status(400).json({
      success: false,
      message: 'Destination name and current budget are required',
    });
  }

  const optimization = await expenseService.getPersonalizedBudgetOptimization(
    destinationName,
    currentBudget,
    currentExpenses || [],
    preferences
  );

  res.status(StatusCodes.OK).json({
    success: true,
    message: "Personalized budget optimization fetched successfully",
    data: optimization,
  });
});



const getDestinationBudgetInsights = asyncWrapper(async (req: Request, res: Response) => {
  const { destinationName } = req.params;
  
  if (!destinationName) {
    return res.status(400).json({
      success: false,
      message: 'Destination name is required',
    });
  }

  const insights = await expenseService.getDestinationBudgetInsights(destinationName);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Budget insights for ${destinationName} fetched successfully`,
    data: {
      destination: destinationName,
      insights,
    },
  });
});


const getExpensesByUser = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  const expenses = await expenseService.getExpensesByUser(userId);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `All Expenses for user ${userId} fetched successfully`,
    data: expenses,
  });
});

const getUserExpensesByDateRange = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { startDate, endDate } = req.query;

  if (typeof startDate !== 'string' || typeof endDate !== 'string') {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'startDate and endDate query parameters are required and must be strings.',
    });
  }

  const expenses = await expenseService.getUserExpensesByDateRange(userId, new Date(startDate), new Date(endDate));

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Expenses for user ${userId} from ${startDate} to ${endDate} fetched successfully`,
    data: expenses,
  });
});

const getUserExpensesByCategory = asyncWrapper(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { category } = req.params;

  if (!category) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Category is required',
    });
  }

  const expenses = await expenseService.getUserExpensesByCategory(userId, category as ExpenseCategory);

  res.status(StatusCodes.OK).json({
    success: true,
    message: `Expenses for user ${userId} in category ${category} fetched successfully`,
    data: expenses,
  });
});

export const expenseController = {
  createExpense,
  updateExpense,
  deleteExpense,
  bulkCreateExpenses,
  getTripExpenses,
  getExpensesByDateRange,
  getUserExpensesByDateRange,
  getUserExpensesByCategory,
  getExpensesByCategory,
  getBudgetAnalysis,
  generateBudgetOptimization,
  getExpenseStats,
  getExpensesByUser,
  getExpenseSummary,
  exportExpenses,
  getSpendingTrends,
  generateSmartBudgetRecommendations,
  getPersonalizedBudgetOptimization,
  getDestinationBudgetInsights
};