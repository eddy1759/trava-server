import { Router } from 'express';
import { expenseController} from './expense.controller';
import { authMiddleware } from '../../middlewares/auth';
import { validateBody, validateParams, validateQuery } from '../../middlewares/validation.middleware';
import { expenseValidationSchema } from './expense.validation';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Personal user expense routes

router.get('/user', expenseController.getExpensesByUser);
router.get('/user/range', validateQuery(expenseValidationSchema.dateRangeSchema), expenseController.getUserExpensesByDateRange);
router.get('/user/category/:category', expenseController.getUserExpensesByCategory);


// Trip-specific expense routes

router.post('/', validateBody(expenseValidationSchema.createExpenseSchema), expenseController.createExpense);
router.post('/bulk', expenseController.bulkCreateExpenses);
router.get('/trip/:tripId', expenseController.getTripExpenses);

router.get('/trip/:tripId/range', validateQuery(expenseValidationSchema.dateRangeSchema), expenseController.getExpensesByDateRange);

router.get('/trip/:tripId/category/:category', expenseController.getExpensesByCategory);

router.get('/trip/:tripId/summary', expenseController.getExpenseSummary);

router.get('/trip/:tripId/stats', expenseController.getExpenseStats);

router.get('/trip/:tripId/trends', expenseController.getSpendingTrends);

router.get('/trip/:tripId/budget-analysis', expenseController.getBudgetAnalysis);

router.get('/trip/:tripId/export', expenseController.exportExpenses);


// Individual expense operations

router.put('/:expenseId', validateBody(expenseValidationSchema.updateExpenseSchema), expenseController.updateExpense);

router.delete('/:expenseId', expenseController.deleteExpense);


// AI-powered features

router.post('/budget-optimization', validateBody(expenseValidationSchema.budgetOptimizationSchema), expenseController.generateBudgetOptimization);

router.post('/smart-recommendations', validateBody(expenseValidationSchema.smartBudgetRecommendationsSchema), expenseController.generateSmartBudgetRecommendations);

router.post('/personalized-optimization', expenseController.getPersonalizedBudgetOptimization);

router.get('/insights/:destinationName', expenseController.getDestinationBudgetInsights);

export default router;

