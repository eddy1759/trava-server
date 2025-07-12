import { PrismaClient, Prisma } from '@prisma/client';
import logger from '../utils/logger';
import CONFIG from '../config/env';


export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  details: {
    connected: boolean;
    responseTime: number;
  };
}

export interface DbStatsResponse {
  tableCounts: Record<string, number>;
  connectionInfo: {
    connected: boolean;
  };
}

/**
 * PrismaService - A singleton wrapper around the PrismaClient.
 *
 * This class provides a robust, singleton instance of the PrismaClient,
 * ensuring a single connection pool is used throughout the application.
 * It includes features for graceful connection handling, health checks,
 * and resilient transactions.
 *
 * @class PrismaService
 */
class PrismaService {
  private static instance: PrismaService;
  public readonly client: PrismaClient;

  /**
   * The constructor is private to enforce the singleton pattern.
   * It initializes the PrismaClient with logging and datasource configuration.
   */
  private constructor() {
    this.client = new PrismaClient({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
        { emit: 'stdout', level: 'info' },
      ],
      datasources: {
        db: {
          url: CONFIG.DATABASE_URL,
        },
      },
    });
  }

  /**
   * Provides access to the singleton instance of the PrismaService.
   * @returns {PrismaService} The singleton instance.
   */
  public static getInstance(): PrismaService {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaService();
    }
    return PrismaService.instance;
  }

  /**
   * Connects to the database. Primarily used for an initial health check on app startup.
   * Prisma connects lazily, so this is not required for normal operation.
   */
  public async connect(): Promise<void> {
    try {
      logger.info('Testing database connection...');
      // $queryRaw`SELECT 1` is a lightweight query to confirm connectivity.
      await this.client.$queryRaw`SELECT 1`;
      logger.info('Database connection successful.');
    } catch (error) {
      logger.error('Database connection failed on startup:', error);
      // Depending on the application's needs, you might want to exit the process.
      // process.exit(1);
      throw error; // Re-throw to allow caller to handle it.
    }
  }

  /**
   * Disconnects from the database. Essential for graceful shutdown.
   */
  public async disconnect(): Promise<void> {
    try {
      logger.info('Disconnecting from database...');
      await this.client.$disconnect();
      logger.info('Database disconnected successfully.');
    } catch (error) {
      logger.error('Failed to disconnect from database:', error);
      throw error;
    }
  }

  /**
   * Executes a database transaction with automatic retries on specific, transient errors.
   *
   * @template T The return type of the transaction function.
   * @param { (tx: Prisma.TransactionClient) => Promise<T> } fn The function to execute within the transaction.
   * @param {object} [options] - Optional settings for the transaction.
   * @param {number} [options.maxRetries=3] - The maximum number of retry attempts.
   * @param {number} [options.timeout=30000] - The timeout for the transaction in milliseconds.
   * @returns {Promise<T>} The result of the transaction function.
   */
  public async transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { maxRetries?: number; timeout?: number }
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3;
    const timeout = options?.timeout ?? 30000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.client.$transaction(fn, {
          maxWait: timeout,
          timeout,
        });
      } catch (error: unknown) {
        if (attempt === maxRetries || !this.isRetryableError(error)) {
          logger.error(`Transaction failed after ${attempt} attempts.`, error);
          throw error;
        }

        const delay = Math.min(100 * 2 ** attempt, 5000); // Exponential backoff
        logger.warn(
          `Transaction attempt ${attempt} failed, retrying in ${delay}ms...`,
          (error as Error).message
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    // This line should be unreachable, but it satisfies TypeScript's control flow analysis.
    throw new Error('Transaction failed after all retry attempts.');
  }

  /**
   * Checks if an error is a known, retryable Prisma error (e.g., deadlock).
   * @param {unknown} error The error to check.
   * @returns {boolean} True if the error is retryable.
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // See Prisma error codes: https://www.prisma.io/docs/reference/api-reference/error-reference
      const retryableCodes = [
        'P2034', // Transaction failed due to a write conflict or a deadlock.
        'P2024', // A connection pool timeout occurred.
      ];
      return retryableCodes.includes(error.code);
    }
    return false;
  }

  /**
   * Performs a health check on the database connection.
   * @returns {Promise<HealthCheckResponse>} An object containing the health status.
   */
  public async healthCheck(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    try {
      await this.client.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;
      return {
        status: 'healthy',
        details: { connected: true, responseTime },
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          responseTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Retrieves statistics from the database, such as row counts for all tables.
   * This version dynamically fetches table names.
   * @returns {Promise<DbStatsResponse>} An object containing database statistics.
   */
  public async getStats(): Promise<DbStatsResponse> {
    const tableCounts: Record<string, number> = {};
    try {
      // This query is for PostgreSQL. It might need adjustment for other databases (e.g., MySQL, SQLite).
      const tablesResult = await this.client.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `;
      const tables = tablesResult.map((t) => t.tablename);

      for (const table of tables) {
        try {
          // Note: Using Prisma's model name might be different from the table name.
          // This assumes a direct mapping. For complex cases, a mapping object might be needed.
          const modelKey = Object.keys(this.client).find(
            (k) => k.toLowerCase() === table.toLowerCase() && k !== '_baseDmmf'
          );
          if (modelKey) {
            const count = await (this.client as any)[modelKey].count();
            tableCounts[modelKey] = count;
          }
        } catch (error) {
          logger.warn(`Failed to get count for table ${table}:`, error);
          tableCounts[table] = -1; // Indicate an error
        }
      }

      return {
        tableCounts,
        connectionInfo: { connected: true },
      };
    } catch (error) {
      logger.error('Failed to retrieve database stats:', error);
      return {
        tableCounts: {},
        connectionInfo: { connected: false },
      };
    }
  }
}


// Create singleton instance
const prismaService = PrismaService.getInstance();

export const prisma: PrismaClient = prismaService.client;
export const connectToDatabase = () => prismaService.connect();
export const disconnectFromDatabase = () => prismaService.disconnect();
export const dBisConnected = async () => {
  const healthCheck = await prismaService.healthCheck();
  return healthCheck.status === 'healthy';
};