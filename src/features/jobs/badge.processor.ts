import { Job } from 'bull';
import { badgeService } from '../services/badge.service';
import { prisma } from '../utils/prisma';
import { badgeQueue } from '../queues/badge.queue'; // We might need to queue individual jobs on failure

interface BadgeJobData {
  userId: string;
}

// --- Configuration for Batching ---
const BATCH_SIZE = 100; // Number of users to process in one go. Tune this based on performance.
const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay to give the DB a break.

/**
 * A simple delay utility
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const badgeProcessor = async (job: Job<BadgeJobData | 'check-all-users'>): Promise<void> => {
  console.log(`Processing job ${job.id} with data:`, job.data);

  // The logic for individual, real-time jobs remains the same.
  if (job.data !== 'check-all-users') {
    const { userId } = job.data as BadgeJobData;
    if (!userId) {
      throw new Error('Job data is missing userId');
    }
    await badgeService.evaluateUserAchievements(userId);
    return;
  }

  // --- BATCH PROCESSING LOGIC for the nightly cron job ---
  console.log('Starting nightly batch processing for all users...');

  // 1. Fetch all user IDs
  const allUserIds = await prisma.user.findMany({
    where: { deleted: false },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${allUserIds.length} total users to process in batches of ${BATCH_SIZE}.`);
  let processedCount = 0;

  // 2. Loop through in batches
  for (let i = 0; i < allUserIds.length; i += BATCH_SIZE) {
    const batch = allUserIds.slice(i, i + BATCH_SIZE);
    const batchNumber = (i / BATCH_SIZE) + 1;

    console.log(`Processing batch ${batchNumber}... (${batch.length} users)`);
    
    try {
      // 3. Process the current batch concurrently
      await Promise.all(
        batch.map(user => badgeService.evaluateUserAchievements(user.id))
      );
      processedCount += batch.length;
      console.log(`Batch ${batchNumber} completed. Total processed: ${processedCount}/${allUserIds.length}`);

    } catch (error) {
        // If the entire batch fails, log the error and continue to the next batch.
        // For more resilience, you could re-queue the failed users individually.
        console.error(`Error processing batch ${batchNumber}.`, error);
    }
    
    // 4. Wait before starting the next batch
    if (i + BATCH_SIZE < allUserIds.length) {
      await delay(DELAY_BETWEEN_BATCHES);
    }
  }

  console.log('Nightly batch processing completed.');
};