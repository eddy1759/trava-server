import Queue from 'bull';

// 1. Create a queue instance
// Make sure your Redis connection details are in environment variables
export const badgeQueue = new Queue('badge-updates', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
});

// 2. Function to add a job for a single user
// Call this after a user completes a relevant action (e.g., finishes a trip)
export const scheduleBadgeUpdateForUser = (userId: string) => {
  badgeQueue.add({ userId }, {
    attempts: 3, // Retry up to 3 times if the job fails
    removeOnComplete: true, // Clean up successful jobs
    removeOnFail: true,
  });
};

// 3. CRON Job to update all users periodically (e.g., daily)
// This is a catch-all to ensure data consistency
export const scheduleAllUsersBadgeUpdate = () => {
  badgeQueue.add('check-all-users', {}, {
    repeat: { cron: '0 2 * * *' }, // Run every day at 2:00 AM
    jobId: 'nightly-badge-check', // Prevents duplicate cron jobs on restart
    removeOnComplete: true,
    removeOnFail: true,
  });
};

// Immediately schedule the cron job when the server starts.
scheduleAllUsersBadgeUpdate();

badgeQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed successfully.`);
});

badgeQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err.message);
});