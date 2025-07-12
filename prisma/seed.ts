import { BadgeSlug, BadgeCategory, BadgeRarity } from '@prisma/client';
import { prisma } from '../src/services/prisma';
import logger from '../src/utils/logger';


/**
 * @description A comprehensive list of all badges available in the system.
 * The `criteria` field is a flexible JSON object whose keys are interpreted by the badge evaluation logic.
 *
 * Standard Criteria Keys:
 * - `completedTrips`: Number of trips with status 'COMPLETED'.
 * - `distinctCountries`: Number of unique countries visited across completed trips.
 * - `publicTrips`: Number of trips marked as public.
 * - `totalLikes`: Total number of likes received across all public trips.
 * - `totalComments`: Total number of comments received across all public trips.
 * - `budgetTrips`: Number of trips completed under the estimated budget.
 * - `totalSavings`: Cumulative amount saved across all trips (estimatedBudget - actualExpenses).
 * - `journalEntries`: Total number of journal entries created.
 * - `photos`: Total number of photos uploaded.
 */
const  badgesToSeed =  [
    // TRAVEL MILESTONES
    {
        slug: BadgeSlug.FIRST_TRIP,
        name: 'First Trip',
        description: 'Awarded for completing your first trip.',
        category: BadgeCategory.TRAVEL_MILESTONES,
        rarity: BadgeRarity.COMMON,
        points: 100,
        criteria: { completedTrips: 1 },
        iconUrl: '/badges/first_trip.svg',
    },
    {
        slug: BadgeSlug.FREQUENT_TRIP,
        name: 'Seasoned Voyager',
        description: 'Awarded for completing 5 or more trips.',
        category: BadgeCategory.TRAVEL_MILESTONES,
        rarity: BadgeRarity.RARE,
        points: 200,
        criteria: { completedTrips: 5 },
        iconUrl: '/badges/frequent_trip.svg',
    },
    {
        slug: BadgeSlug.WORLD_WANDERER,
        name: 'Global Globetrotter',
        description: 'Awarded for visiting 15 different countries.',
        category: BadgeCategory.TRAVEL_MILESTONES,
        rarity: BadgeRarity.EPIC,
        points: 500,
        criteria: { completedTrips: 15 },
        iconUrl: '/badges/world_wanderer.svg',
    },
    {
        slug: BadgeSlug.LEGENDARY_NOMAD,
        name: 'Legendary Nomad',
        description: 'Awarded for visiting 50 different countries.',
        category: BadgeCategory.TRAVEL_MILESTONES,
        rarity: BadgeRarity.LEGENDARY,
        points: 3000,
        criteria: { distinctCountries: 50 },
        iconUrl: '/badges/legendary_nomad.svg',
    },

    // SOCIAL ENGAGEMENT
    {
        slug: BadgeSlug.SOCIAL_STARTER,
        name: 'Community Newbie',
        description: 'Awarded for sharing your first trip publicly.',
        category: BadgeCategory.SOCIAL_ENGAGEMENT,
        rarity: BadgeRarity.COMMON,
        points: 100,
        criteria: { publicTrips: 1 },
        iconUrl: '/badges/community_newbie.svg',
    },
    {
        slug: BadgeSlug.SOCIAL_INFLUENCER,
        name: 'Social Influencer',
        description: 'Awarded for sharing 15 trips publicly.',
        category: BadgeCategory.SOCIAL_ENGAGEMENT,
        rarity: BadgeRarity.EPIC,
        points: 500,
        criteria: { publicTrips: 15 },
        iconUrl: '/badges/social_influencer.svg',
    },
    {
        slug: BadgeSlug.TRAVEL_AMBASSADOR,
        name: 'Travel Ambassador',
        description: 'Awarded for sharing 50 trips and receiving 200+ likes on your photos.',
        category: BadgeCategory.SOCIAL_ENGAGEMENT,
        rarity: BadgeRarity.LEGENDARY,
        points: 2500,
        criteria: { publicTrips: 50, totalLikes: 200 },
        iconUrl: '/badges/travel_ambassador.svg',
    },
    {
        slug: BadgeSlug.ENGAGEMENT_STAR,
        name: 'Engagement Star',
        description: 'Awarded for receiving 100+ comments across your shared photos.',
        category: BadgeCategory.SOCIAL_ENGAGEMENT,
        rarity: BadgeRarity.RARE,
        points: 400,
        criteria: { totalComments: 100 },
        iconUrl: '/badges/engagement_star.svg',
    },

    // FINANCIAL PLANNING
    {
        slug: BadgeSlug.BUDGET_TRAVELER,
        name: 'Budget Traveler',
        description: 'Awarded for completing a trip under budget.',
        category: BadgeCategory.FINANCIAL_PLANNING,
        rarity: BadgeRarity.COMMON,
        points: 100,
        criteria: { budgetTrips: 1 },
        iconUrl: '/badges/budget_traveler.svg',
    },
    {
        slug: BadgeSlug.FINANCIAL_NINJA,
        name: 'Financial Ninja',
        description: 'Awarded for staying under budget on 10 trips.',
        category: BadgeCategory.FINANCIAL_PLANNING,
        rarity: BadgeRarity.LEGENDARY,
        points: 2000,
        criteria: { budgetTrips: 10 },
        iconUrl: '/badges/financial_ninja.svg',
    },
    {
        slug: BadgeSlug.SAVINGS_MASTERMIND,
        name: 'Savings Mastermind',
        description: 'Awarded for saving over $10,000 cumulatively across all trips.',
        category: BadgeCategory.FINANCIAL_PLANNING,
        rarity: BadgeRarity.EPIC,
        points: 1500,
        criteria: { totalSavings: 10000 },
        iconUrl: '/badges/savings_mastermind.svg',
    },

    // CONTENT CREATION
    {
        slug: BadgeSlug.FIRST_JOURNAL_ENTRY,
        name: 'Journalist',
        description: 'Awarded for writing 5 journal entries.',
        category: BadgeCategory.CONTENT_CREATION,
        rarity: BadgeRarity.COMMON,
        points: 100,
        criteria: { journalEntries: 5 },
        iconUrl: '/badges/journalist.svg',
    },
    {
        slug: BadgeSlug.STORYTELLER,
        name: 'Content Creator',
        description: 'Awarded for writing 20 journal entries.',
        category: BadgeCategory.CONTENT_CREATION,
        rarity: BadgeRarity.RARE,
        points: 500,
        criteria: { journalEntries: 20 },
        iconUrl: '/badges/content_creator.svg',
    },
    {
        slug: BadgeSlug.PHOTOGRAPHER,
        name: 'Photographer',
        description: 'Awarded for uploading 50 photos.',
        category: BadgeCategory.CONTENT_CREATION,
        rarity: BadgeRarity.EPIC,
        points: 1000,
        criteria: { photos: 50 },
        iconUrl: '/badges/photographer.svg',
    },
    {
        slug: BadgeSlug.CREATOR_LEGEND,
        name: 'Legendary Creator',
        description: 'Awarded for publishing 100 journal entries and 200 photos.',
        category: BadgeCategory.CONTENT_CREATION,
        rarity: BadgeRarity.LEGENDARY,
        points: 3000,
        criteria: { journalEntries: 100, photos: 200 },
        iconUrl: '/badges/creator_legend.svg',
    },

    {
        slug: BadgeSlug.VISUAL_STORYTELLER,
        name: 'Visual Storyteller',
        description: 'Awarded for uploading 100+ travel photos.',
        category: BadgeCategory.CONTENT_CREATION,
        rarity: BadgeRarity.RARE,
        points: 600,
        criteria: { photos: 100 },
        iconUrl: '/badges/visual_storyteller.svg',
    }
];
    
async function seedBadges() {
    logger.info('Starting to seed badges...');
    for (const badgeData of badgesToSeed) {
        // Use `upsert` to avoid duplicates and allow for easy updates to badge details
        await prisma.badge.upsert({
            where: { slug: badgeData.slug },
            update: {
                ...badgeData,
                criteria: badgeData.criteria || {}, // Ensure criteria is a valid JSON
            },
            create: {
                ...badgeData,
                criteria: badgeData.criteria || {},
            },
        });
        logger.info(`Upserted badge: ${badgeData.name}`);
    }
    logger.info('Badge seeding completed.');
}

async function main() {
    try {
        await seedBadges();
    } catch (error) {
        logger.error('An error occurred during seeding:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();