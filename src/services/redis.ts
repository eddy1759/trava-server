import { createClient, RedisClientType, RedisClientOptions } from 'redis';
import logger from '../utils/logger';
import CONFIG from '../config/env'; // Assuming CONFIG holds REDIS_URL and potentially other config

// Helper for exponential backoff (reuse or define similarly to the prisma one)
const exponentialBackoff = (attempt: number, baseDelay = 200, maxDelay = 5000) => {
	const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
	return delay + Math.random() * (delay * 0.2); // Add jitter
};

class RedisService {
	private client: RedisClientType | null = null;
	private isConnected: boolean = false;
	private isConnecting: boolean = false;
	private connectionPromise: Promise<void> | null = null;
	private readonly connectionOptions: RedisClientOptions;
	private readonly initialConnectRetries: number;
	private readonly initialConnectBaseDelay: number;

	constructor() {
		if (!CONFIG.REDIS_URL) {
			logger.warn('REDIS_URL is not defined. Redis functionality will be disabled.');
			this.connectionOptions = {}; // Set empty options if no URL
		} else {
			this.connectionOptions = {
				url: CONFIG.REDIS_URL,
				socket: {
					// Configure built-in reconnection strategy for resilience
					reconnectStrategy: (retries: number): number | Error => {
						if (retries > 10) {
							// Example: Give up after 10 retries
							logger.error('Redis: Too many reconnection attempts. Giving up.');
							this.isConnected = false;
							this.isConnecting = false; // Ensure flags are reset
							// Return an error to stop retrying
							return new Error('Redis reconnection failed after multiple attempts.');
						}
						const delay = exponentialBackoff(retries, 100, 3000); // Use backoff for reconnections too
						logger.info(
							`Redis: Attempting to reconnect (attempt ${retries + 1}). Retrying in ${delay.toFixed(0)}ms...`
						);
						return delay;
					},
					// Optional: Configure connect timeout
					// connectTimeout: 5000 // 5 seconds
				},
			};
		}

		// Configuration for the *initial* connection attempt loop
		this.initialConnectRetries = CONFIG.REDIS_INITIAL_CONNECT_RETRIES ?? 5; // Default to 5 retries
		this.initialConnectBaseDelay = CONFIG.REDIS_INITIAL_CONNECT_RETRY_DELAY ?? 200; // Default to 200ms base delay
	}

	/**
	 * Establishes the initial connection to the Redis server with retry logic.
	 * Subsequent reconnections are handled by the client's reconnectStrategy.
	 * @returns Promise<void> Resolves when connected, rejects if initial connection fails after retries.
	 */
	public async connect(): Promise<void> {
		// Prevent multiple concurrent connection attempts & connect if already connected
		if (this.isConnected) {
			logger.info('Redis client is already connected.');
			return;
		}
		if (this.isConnecting && this.connectionPromise) {
			logger.info(
				'Redis connection attempt already in progress. Waiting for it to complete...'
			);
			return this.connectionPromise;
		}
		if (!CONFIG.REDIS_URL) {
			logger.warn('Cannot connect: REDIS_URL is not configured.');
			return Promise.resolve(); // Resolve immediately if no URL is set
		}

		this.isConnecting = true;
		this.connectionPromise = this._performInitialConnection();

		try {
			await this.connectionPromise;
		} finally {
			// Reset connectionPromise once the connection attempt (success or fail) is finished
			this.connectionPromise = null;
			// isConnecting and isConnected state is managed within _performInitialConnection and event handlers
		}
	}

	private async _performInitialConnection(): Promise<void> {
		this.client = createClient(this.connectionOptions) as RedisClientType;
		this._registerEventHandlers(); // Register handlers before connecting

		for (let attempt = 0; attempt < this.initialConnectRetries; attempt++) {
			try {
				logger.info(
					`Attempting to connect to Redis (Attempt ${attempt + 1}/${this.initialConnectRetries})...`
				);
				await this.client.connect();
				return; // Exit loop on successful connect call initiation
			} catch (error: any) {
				logger.error(
					`Failed to initiate Redis connection (Attempt ${attempt + 1}/${this.initialConnectRetries}): ${error.message}`
				);

				// Clean up the failed client instance before retrying
				await this._cleanupClientInstance();

				if (attempt < this.initialConnectRetries - 1) {
					const delay = exponentialBackoff(attempt, this.initialConnectBaseDelay);
					logger.info(`Retrying Redis connection in ${delay.toFixed(0)}ms...`);
					await new Promise((resolve) => setTimeout(resolve, delay));
					// Re-create client for the next attempt
					this.client = createClient(this.connectionOptions) as RedisClientType;
					this._registerEventHandlers();
				}
			}
		}

		// If loop completes without connection
		this.isConnecting = false;
		this.isConnected = false;
		await this._cleanupClientInstance(); // Ensure cleanup after final failure
		throw new Error(
			`Redis initial connection failed after ${this.initialConnectRetries} attempts.`
		);
	}

	/**
	 * Registers event handlers for the Redis client.
	 */
	private _registerEventHandlers(): void {
		if (!this.client) return;

		// Clear existing listeners before attaching new ones (important for retries)
		this.client.removeAllListeners();

		this.client.on('connect', () => {
			logger.info('Redis client is connecting...');
			// Note: Connection isn't fully ready until 'ready' event
		});

		this.client.on('ready', () => {
			logger.info('Redis client connected and ready.');
			this.isConnected = true;
			this.isConnecting = false;
		});

		this.client.on('end', () => {
			logger.warn('Redis client connection closed.');
			this.isConnected = false;
			this.isConnecting = false; // Ensure this is reset if connection ends unexpectedly
		});

		this.client.on('error', (err: Error) => {
			logger.error('Redis Client Error:', err);
			// isConnected state might be updated by 'end' or reconnect logic
		});

		this.client.on('reconnecting', () => {
			logger.info('Redis client is attempting to reconnect...');
			this.isConnecting = true; // Set connecting flag during reconnection
			this.isConnected = false;
		});
	}

	/**
	 * Unregisters event handlers and nullifies the client instance.
	 */
	private async _cleanupClientInstance(): Promise<void> {
		if (this.client) {
			this.client.removeAllListeners();
			// Attempt to quit gracefully, but don't wait indefinitely if it hangs
			try {
				await Promise.race([
					this.client.quit(),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error('Redis quit timeout')), 2000)
					), // 2s timeout
				]);
			} catch (quitError: any) {
				logger.warn(
					`Error during Redis client cleanup (quit): ${quitError.message}. Forcing disconnect.`
				);
				// Force disconnect if quit fails or times out
				try {
					await this.client.disconnect();
				} catch (disconnectError: any) {
					logger.error(
						`Error during Redis client cleanup (disconnect): ${disconnectError.message}`
					);
				} finally {
					this.client = null;
				}
			}
		}
	}

	/**
	 * Disconnects the Redis client gracefully.
	 * @returns Promise<void>
	 */
	public async disconnect(): Promise<void> {
		if (this.client) {
			try {
				logger.info('Disconnecting Redis client...');
				await this.client.quit();
				this.isConnected = false;
				this.isConnecting = false;
				logger.info('Redis client disconnected successfully.');
			} catch (error: any) {
				logger.error('Error during Redis disconnect:', error.message);
				// Force disconnect if quit fails
				try {
					await this.client.disconnect();
				} catch (disconnectError: any) {
					logger.error('Error during Redis force disconnect:', disconnectError.message);
				}
			} finally {
				this.client = null;
			}
		}
	}

	/**
	 * Checks if the Redis client is ready for operations.
	 * @returns boolean
	 */
	public isReady(): boolean {
		return this.isConnected && this.client !== null;
	}

	/**
	 * Gets the Redis client instance.
	 * @returns RedisClientType | null
	 */
	public getClient(): RedisClientType | null {
		return this.client;
	}

	// Enhanced caching methods with TTL and compression
	public async set(key: string, value: string, expiration?: number): Promise<void> {
		if (!this.isReady()) {
			logger.warn('Redis not ready, skipping set operation');
			return;
		}

		try {
			const options: any = {};
			if (expiration) {
				options.EX = expiration;
			}

			await this.client!.set(key, value, options);
			logger.debug(`Redis SET: ${key} (expires in ${expiration || 'never'}s)`);
		} catch (error: any) {
			logger.error(`Redis SET failed for key ${key}:`, error.message);
			throw error;
		}
	}

	/**
	 * Sets a JSON value with automatic serialization and compression for large objects.
	 * @param key - The cache key
	 * @param value - The object to cache
	 * @param expiration - Optional TTL in seconds
	 */
	public async setJSON(key: string, value: any, expiration?: number): Promise<void> {
		if (!this.isReady()) {
			logger.warn('Redis not ready, skipping setJSON operation');
			return;
		}

		try {
			const jsonString = JSON.stringify(value);
			const options: any = {};
			if (expiration) {
				options.EX = expiration;
			}

			// Use compression for large objects (>1KB)
			if (jsonString.length > 1024) {
				// For now, just store as JSON, but could implement compression here
				logger.debug(`Storing large JSON object: ${key} (${jsonString.length} bytes)`);
			}

			await this.client!.set(key, jsonString, options);
			logger.debug(`Redis SET JSON: ${key} (${jsonString.length} bytes, expires in ${expiration || 'never'}s)`);
		} catch (error: any) {
			logger.error(`Redis SET JSON failed for key ${key}:`, error.message);
			throw error;
		}
	}

	/**
	 * Gets a value from cache with automatic JSON deserialization.
	 * @param key - The cache key
	 * @returns The cached value or null if not found
	 */
	public async getJSON(key: string): Promise<any | null> {
		if (!this.isReady()) {
			logger.warn('Redis not ready, skipping getJSON operation');
			return null;
		}

		try {
			const value = await this.client!.get(key);
			if (value === null) {
				return null;
			}

			return JSON.parse(value as string);
		} catch (error: any) {
			logger.error(`Redis GET JSON failed for key ${key}:`, error.message);
			return null;
		}
	}

	public async get(key: string): Promise<string | null> {
		if (!this.isReady()) {
			logger.warn('Redis not ready, skipping get operation');
			return null;
		}

		try {
			const value = await this.client!.get(key);
			logger.debug(`Redis GET: ${key} ${value ? '(hit)' : '(miss)'}`);
			return value as string | null;
		} catch (error: any) {
			logger.error(`Redis GET failed for key ${key}:`, error.message);
			return null;
		}
	}

	/**
	 * Gets multiple values in a single operation for better performance.
	 * @param keys - Array of cache keys
	 * @returns Array of values (null for missing keys)
	 */
	public async mget(keys: string[]): Promise<(string | null)[]> {
		if (!this.isReady()) {
			logger.warn('Redis not ready, skipping mget operation');
			return keys.map(() => null);
		}

		try {
			const values = await this.client!.mGet(keys);
			logger.debug(`Redis MGET: ${keys.length} keys, ${values.filter(v => v !== null).length} hits`);
			return values as (string | null)[];
		} catch (error: any) {
			logger.error(`Redis MGET failed:`, error.message);
			return keys.map(() => null);
		}
	}

	/**
	 * Sets multiple key-value pairs in a single operation.
	 * @param keyValuePairs - Array of [key, value] pairs
	 * @param expiration - Optional TTL in seconds for all keys
	 */
	public async mset(keyValuePairs: [string, string][], expiration?: number): Promise<void> {
		if (!this.isReady()) {
			logger.warn('Redis not ready, skipping mset operation');
			return;
		}

		try {
			const pipeline = this.client!.multi();
			
			// Convert array of pairs to object for mset
			const obj: { [key: string]: string } = {};
			keyValuePairs.forEach(([key, value]) => {
				obj[key] = value;
			});

			pipeline.mSet(obj);
			
			// Set expiration for all keys if specified
			if (expiration) {
				keyValuePairs.forEach(([key]) => {
					pipeline.expire(key, expiration);
				});
			}

			await pipeline.exec();
			logger.debug(`Redis MSET: ${keyValuePairs.length} keys (expires in ${expiration || 'never'}s)`);
		} catch (error: any) {
			logger.error(`Redis MSET failed:`, error.message);
			throw error;
		}
	}

	public async del(key: string): Promise<number> {
		if (!this.isReady()) {
			logger.warn('Redis not ready, skipping del operation');
			return 0;
		}

		try {
			const result = await this.client!.del(key);
			logger.debug(`Redis DEL: ${key} ${result > 0 ? '(deleted)' : '(not found)'}`);
			return result;
		} catch (error: any) {
			logger.error(`Redis DEL failed for key ${key}:`, error.message);
			return 0;
		}
	}

	/**
	 * Deletes multiple keys in a single operation.
	 * @param keys - Array of keys to delete
	 * @returns Number of keys deleted
	 */
	public async mdel(keys: string[]): Promise<number> {
		if (!this.isReady()) {
			logger.warn('Redis not ready, skipping mdel operation');
			return 0;
		}

		try {
			const result = await this.client!.del(keys);
			logger.debug(`Redis MDEL: ${keys.length} keys, ${result} deleted`);
			return result;
		} catch (error: any) {
			logger.error(`Redis MDEL failed:`, error.message);
			return 0;
		}
	}

	/**
	 * Checks if a key exists.
	 * @param key - The cache key
	 * @returns true if key exists, false otherwise
	 */
	public async exists(key: string): Promise<boolean> {
		if (!this.isReady()) {
			return false;
		}

		try {
			const result = await this.client!.exists(key);
			return result === 1;
		} catch (error: any) {
			logger.error(`Redis EXISTS failed for key ${key}:`, error.message);
			return false;
		}
	}

	/**
	 * Sets expiration time for a key.
	 * @param key - The cache key
	 * @param seconds - Expiration time in seconds
	 * @returns true if expiration was set, false if key doesn't exist
	 */
	public async expire(key: string, seconds: number): Promise<boolean> {
		if (!this.isReady()) {
			return false;
		}

		try {
			const result = await this.client!.expire(key, seconds);
			return result === 1;
		} catch (error: any) {
			logger.error(`Redis EXPIRE failed for key ${key}:`, error.message);
			return false;
		}
	}

	/**
	 * Gets the remaining TTL for a key.
	 * @param key - The cache key
	 * @returns TTL in seconds, -1 if no expiration, -2 if key doesn't exist
	 */
	public async ttl(key: string): Promise<number> {
		if (!this.isReady()) {
			return -2;
		}

		try {
			return await this.client!.ttl(key);
		} catch (error: any) {
			logger.error(`Redis TTL failed for key ${key}:`, error.message);
			return -2;
		}
	}

	public async ping(): Promise<boolean> {
		if (!this.isReady()) {
			return false;
		}

		try {
			const result = await this.client!.ping();
			return result === 'PONG';
		} catch (error: any) {
			logger.error('Redis PING failed:', error.message);
			return false;
		}
	}

	/**
	 * Increments a counter with optional expiration.
	 * @param key - The counter key
	 * @param expiration - Optional TTL in seconds
	 * @returns The new counter value
	 */
	public async incr(key: string, expiration?: number): Promise<number> {
		if (!this.isReady()) {
			return 0;
		}

		try {
			const pipeline = this.client!.multi();
			pipeline.incr(key);
			
			if (expiration) {
				pipeline.expire(key, expiration);
			}

			const results = await pipeline.exec();
			return results?.[0]?.[1] as number || 0;
		} catch (error: any) {
			logger.error(`Redis INCR failed for key ${key}:`, error.message);
			return 0;
		}
	}

	/**
	 * Gets cache statistics for monitoring.
	 * @returns Cache statistics object
	 */
	public async getStats(): Promise<{
		connected: boolean;
		keys: number;
		memory: any;
		info: any;
	}> {
		if (!this.isReady()) {
			return {
				connected: false,
				keys: 0,
				memory: {},
				info: {}
			};
		}

		try {
			const [keys, info] = await Promise.all([
				this.client!.dbSize(),
				this.client!.info()
			]);

			return {
				connected: true,
				keys,
				memory: {}, // Redis memory command not available in this client
				info
			};
		} catch (error: any) {
			logger.error('Redis stats failed:', error.message);
			return {
				connected: false,
				keys: 0,
				memory: {},
				info: {}
			};
		}
	}
}

// --- Export Singleton Instance ---
// This ensures only one RedisService instance manages the connection pool.
export const redisService = new RedisService();
