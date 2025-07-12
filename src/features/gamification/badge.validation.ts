import { z } from 'zod';

const badgeCategories = [
    'TRAVEL_MILESTONES',
    'SOCIAL_ENGAGEMENT',
    'FINANCIAL_PLANNING',
    'CONTENT_CREATION',
] as const;

export const badgeValidationSchemas = {
    getBadgesByCategory: z.object({
        params: z.object({
            category: z.enum(badgeCategories, {
                required_error: 'Badge category is required',
                invalid_type_error: 'Invalid badge category',
            }),
        }),
    }),

    getUserBadges: z.object({
        params: z.object({
            userId: z.string().uuid('Invalid user ID format'),
        }),
    }),

    evaluateAchievements: z.object({
        params: z.object({
            userId: z.string().uuid('Invalid user ID format'),
        }),
    }),
}; 