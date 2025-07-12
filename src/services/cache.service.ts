import { redisService } from './redis';
import logger from '../utils/logger';
import { prisma } from './prisma';

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    prefix?: string; // Cache key prefix
    compress?: boolean; // Whether to compress large objects
    tags?: string[]; // Cache tags for invalidation
}

export interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
    totalRequests: number;
    memoryUsage: number;
}

class CacheService {
    private stats: Map<string, { hits: number; misses: number }> = new Map();
    private readonly defaultTTL = 3600; // 1 hour
    private readonly maxKeyLength = 250; // Redis key length limit

    /**
     * Generates a cache key with proper formatting and length limits
     */
    private generateKey(prefix: string, identifier: string): string {
        const key = `${prefix}:${identifier}`;
        if (key.length > this.maxKeyLength) {
            // Use hash for long keys
            const crypto = require('crypto');
            const hash = crypto.createHash('md5').update(key).digest('hex');
            return `${prefix}:hash:${hash}`;
        }
        return key;
    }

    /**
     * Gets a value from cache with automatic JSON deserialization
     */
    async get<T>(key: string, prefix: string = 'app'): Promise<T | null> {
        const fullKey = this.generateKey(prefix, key);
        
        try {
            const cached = await redisService.getJSON(fullKey);
            if (cached !== null) {
                this.recordHit(prefix);
                logger.debug(`Cache HIT: ${fullKey}`);
                return cached;
            } else {
                this.recordMiss(prefix);
                logger.debug(`Cache MISS: ${fullKey}`);
                return null;
            }
        } catch (error) {
            logger.warn(`Cache GET failed for ${fullKey}:`, error);
            return null;
        }
    }

    /**
     * Sets a value in cache with automatic JSON serialization
     */
    async set<T>(
        key: string, 
        value: T, 
        options: CacheOptions = {}
    ): Promise<void> {
        const { ttl = this.defaultTTL, prefix = 'app', tags = [] } = options;
        const fullKey = this.generateKey(prefix, key);

        try {
            await redisService.setJSON(fullKey, value, ttl);
            
            // Store cache tags for invalidation
            if (tags.length > 0) {
                await this.storeCacheTags(fullKey, tags);
            }

            logger.debug(`Cache SET: ${fullKey} (TTL: ${ttl}s)`);
        } catch (error) {
            logger.warn(`Cache SET failed for ${fullKey}:`, error);
        }
    }

    /**
     * Gets multiple values in a single operation
     */
    async mget<T>(keys: string[], prefix: string = 'app'): Promise<(T | null)[]> {
        const fullKeys = keys.map(key => this.generateKey(prefix, key));
        
        try {
            const values = await redisService.mget(fullKeys);
            const results = values.map(value => {
                if (value === null) return null;
                try {
                    return JSON.parse(value);
                } catch {
                    return null;
                }
            });

            // Update stats
            const hits = results.filter(r => r !== null).length;
            const misses = results.length - hits;
            this.recordHit(prefix, hits);
            this.recordMiss(prefix, misses);

            logger.debug(`Cache MGET: ${keys.length} keys, ${hits} hits, ${misses} misses`);
            return results;
        } catch (error) {
            logger.warn(`Cache MGET failed:`, error);
            return keys.map(() => null);
        }
    }

    /**
     * Sets multiple values in a single operation
     */
    async mset<T>(
        keyValuePairs: [string, T][], 
        options: CacheOptions = {}
    ): Promise<void> {
        const { ttl = this.defaultTTL, prefix = 'app' } = options;
        const fullKeyValuePairs = keyValuePairs.map(([key, value]) => [
            this.generateKey(prefix, key),
            JSON.stringify(value)
        ]) as [string, string][];

        try {
            await redisService.mset(fullKeyValuePairs, ttl);
            logger.debug(`Cache MSET: ${keyValuePairs.length} keys (TTL: ${ttl}s)`);
        } catch (error) {
            logger.warn(`Cache MSET failed:`, error);
        }
    }

    /**
     * Deletes a cache key
     */
    async del(key: string, prefix: string = 'app'): Promise<boolean> {
        const fullKey = this.generateKey(prefix, key);
        
        try {
            const result = await redisService.del(fullKey);
            logger.debug(`Cache DEL: ${fullKey} ${result > 0 ? '(deleted)' : '(not found)'}`);
            return result > 0;
        } catch (error) {
            logger.warn(`Cache DEL failed for ${fullKey}:`, error);
            return false;
        }
    }

    /**
     * Invalidates cache by tags
     */
    async invalidateByTags(tags: string[]): Promise<number> {
        try {
            const keysToDelete: string[] = [];
            
            for (const tag of tags) {
                const tagKey = `cache:tags:${tag}`;
                const taggedKeys = await redisService.getJSON(tagKey) as string[] | null;
                if (taggedKeys) {
                    keysToDelete.push(...taggedKeys);
                }
            }

            if (keysToDelete.length > 0) {
                const deleted = await redisService.mdel(keysToDelete);
                logger.info(`Cache invalidation: ${deleted} keys deleted for tags: ${tags.join(', ')}`);
                return deleted;
            }

            return 0;
        } catch (error) {
            logger.warn(`Cache invalidation failed for tags ${tags.join(', ')}:`, error);
            return 0;
        }
    }

    /**
     * Invalidates cache by pattern
     */
    async invalidateByPattern(pattern: string): Promise<number> {
        try {
            // Note: This requires Redis SCAN command implementation
            // For now, we'll use a simple approach with known patterns
            logger.warn('Pattern-based cache invalidation not fully implemented');
            return 0;
        } catch (error) {
            logger.warn(`Cache pattern invalidation failed for ${pattern}:`, error);
            return 0;
        }
    }

    /**
     * Stores cache tags for invalidation
     */
    private async storeCacheTags(key: string, tags: string[]): Promise<void> {
        try {
            for (const tag of tags) {
                const tagKey = `cache:tags:${tag}`;
                const existingKeys = await redisService.getJSON(tagKey) as string[] | null || [];
                if (!existingKeys.includes(key)) {
                    existingKeys.push(key);
                    await redisService.setJSON(tagKey, existingKeys, 86400); // 24 hours
                }
            }
        } catch (error) {
            logger.warn('Failed to store cache tags:', error);
        }
    }

    /**
     * Records cache hit statistics
     */
    private recordHit(prefix: string, count: number = 1): void {
        const stats = this.stats.get(prefix) || { hits: 0, misses: 0 };
        stats.hits += count;
        this.stats.set(prefix, stats);
    }

    /**
     * Records cache miss statistics
     */
    private recordMiss(prefix: string, count: number = 1): void {
        const stats = this.stats.get(prefix) || { hits: 0, misses: 0 };
        stats.misses += count;
        this.stats.set(prefix, stats);
    }

    /**
     * Gets cache statistics
     */
    getStats(prefix?: string): CacheStats | Record<string, CacheStats> {
        if (prefix) {
            const stats = this.stats.get(prefix) || { hits: 0, misses: 0 };
            const total = stats.hits + stats.misses;
            return {
                hits: stats.hits,
                misses: stats.misses,
                hitRate: total > 0 ? (stats.hits / total) * 100 : 0,
                totalRequests: total,
                memoryUsage: 0, // Would need Redis INFO command
            };
        }

        const allStats: Record<string, CacheStats> = {};
        for (const [key, stats] of this.stats.entries()) {
            const total = stats.hits + stats.misses;
            allStats[key] = {
                hits: stats.hits,
                misses: stats.misses,
                hitRate: total > 0 ? (stats.hits / total) * 100 : 0,
                totalRequests: total,
                memoryUsage: 0,
            };
        }
        return allStats;
    }

    /**
     * Cache warming for frequently accessed data
     */
    async warmCache(): Promise<void> {
        try {
            logger.info('Starting cache warming...');

            // Warm user cache
            await this.warmUserCache();
            
            // Warm destination cache
            await this.warmDestinationCache();
            
            // Warm badge cache
            await this.warmBadgeCache();

            logger.info('Cache warming completed');
        } catch (error) {
            logger.error('Cache warming failed:', error);
        }
    }

    private async warmUserCache(): Promise<void> {
        try {
            const users = await prisma.user.findMany({
                where: { deleted: false },
                select: { id: true, email: true, fullName: true, userType: true },
                take: 100, // Limit to prevent memory issues
            });

            const userPairs = users.map(user => [user.id, user] as [string, any]);
            await this.mset(userPairs, { prefix: 'user', ttl: 1800 }); // 30 minutes

            logger.info(`Warmed user cache with ${users.length} users`);
        } catch (error) {
            logger.warn('User cache warming failed:', error);
        }
    }

    private async warmDestinationCache(): Promise<void> {
        try {
            const destinations = await prisma.destination.findMany({
                include: { location: true },
                take: 50,
            });

            const destinationPairs = destinations.map(dest => [dest.id, dest] as [string, any]);
            await this.mset(destinationPairs, { prefix: 'destination', ttl: 3600 }); // 1 hour

            logger.info(`Warmed destination cache with ${destinations.length} destinations`);
        } catch (error) {
            logger.warn('Destination cache warming failed:', error);
        }
    }

    private async warmBadgeCache(): Promise<void> {
        try {
            const badges = await prisma.badge.findMany({
                where: { isActive: true },
                orderBy: [{ category: 'asc' }, { rarity: 'asc' }],
            });

            const badgePairs = badges.map(badge => [badge.id, badge] as [string, any]);
            await this.mset(badgePairs, { prefix: 'badge', ttl: 7200 }); // 2 hours

            logger.info(`Warmed badge cache with ${badges.length} badges`);
        } catch (error) {
            logger.warn('Badge cache warming failed:', error);
        }
    }

    /**
     * Clears all cache statistics
     */
    clearStats(): void {
        this.stats.clear();
        logger.info('Cache statistics cleared');
    }
}

// Export singleton instance
export const cacheService = new CacheService();

// Export convenience functions
export const cache = {
    get: <T>(key: string, prefix?: string) => cacheService.get<T>(key, prefix),
    set: <T>(key: string, value: T, options?: CacheOptions) => cacheService.set(key, value, options),
    mget: <T>(keys: string[], prefix?: string) => cacheService.mget<T>(keys, prefix),
    mset: <T>(keyValuePairs: [string, T][], options?: CacheOptions) => cacheService.mset(keyValuePairs, options),
    del: (key: string, prefix?: string) => cacheService.del(key, prefix),
    invalidateByTags: (tags: string[]) => cacheService.invalidateByTags(tags),
    invalidateByPattern: (pattern: string) => cacheService.invalidateByPattern(pattern),
    getStats: (prefix?: string) => cacheService.getStats(prefix),
    warmCache: () => cacheService.warmCache(),
    clearStats: () => cacheService.clearStats(),
}; 