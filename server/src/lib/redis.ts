/**
 * Upstash Redis Client
 * Used for caching, session storage, Socket.IO rooms, and token blacklist
 */
import { Redis } from '@upstash/redis';

// Initialize Redis client from Upstash environment variables
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return redis !== null;
}

/**
 * Cache API responses with TTL (Time To Live)
 * @param key Cache key
 * @param value Data to cache
 * @param ttlSeconds Time to live in seconds (default: 300s = 5 min)
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.warn(`Redis cache set failed for key ${key}:`, error);
  }
}

/**
 * Get cached data
 * @param key Cache key
 * @returns Cached value or null if not found/expired
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const data = await redis.get<string>(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn(`Redis cache get failed for key ${key}:`, error);
    return null;
  }
}

/**
 * Delete cached data
 * @param key Cache key
 */
export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (error) {
    console.warn(`Redis cache del failed for key ${key}:`, error);
  }
}

/**
 * Store Socket.IO room membership
 * Maps socket IDs to their connected rooms for multi-instance scaling
 * @param socketId Socket ID
 * @param rooms Array of room names
 * @param ttlSeconds TTL in seconds (default: 24h for session)
 */
export async function storeSocketRooms(socketId: string, rooms: string[], ttlSeconds = 86400): Promise<void> {
  if (!redis) return;
  try {
    const key = `socket:${socketId}`;
    await redis.setex(key, ttlSeconds, JSON.stringify(rooms));
  } catch (error) {
    console.warn(`Failed to store socket rooms:`, error);
  }
}

/**
 * Get Socket.IO room membership
 * @param socketId Socket ID
 */
export async function getSocketRooms(socketId: string): Promise<string[]> {
  if (!redis) return [];
  try {
    const key = `socket:${socketId}`;
    const data = await redis.get<string>(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn(`Failed to get socket rooms:`, error);
    return [];
  }
}

/**
 * Add JWT token to blacklist (on logout)
 * Prevents token reuse after logout
 * @param token JWT token
 * @param expiresIn Token expiry time in seconds
 */
export async function blacklistToken(token: string, expiresIn: number): Promise<void> {
  if (!redis) return;
  try {
    const key = `blacklist:${token}`;
    // TTL should match token expiry to auto-cleanup
    await redis.setex(key, expiresIn, 'true');
  } catch (error) {
    console.warn(`Failed to blacklist token:`, error);
  }
}

/**
 * Check if token is blacklisted
 * @param token JWT token
 */
export async function isTokenBlacklisted(token: string): Promise<boolean> {
  if (!redis) return false;
  try {
    const key = `blacklist:${token}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.warn(`Failed to check token blacklist:`, error);
    return false;
  }
}

/**
 * Store user session data
 * Used for maintaining session state across instances
 * @param userId User ID
 * @param sessionData Session information
 * @param ttlSeconds TTL in seconds (default: 24h)
 */
export async function storeUserSession(userId: string, sessionData: Record<string, unknown>, ttlSeconds = 86400): Promise<void> {
  if (!redis) return;
  try {
    const key = `session:${userId}`;
    await redis.setex(key, ttlSeconds, JSON.stringify(sessionData));
  } catch (error) {
    console.warn(`Failed to store user session:`, error);
  }
}

/**
 * Get user session data
 * @param userId User ID
 */
export async function getUserSession(userId: string): Promise<Record<string, unknown> | null> {
  if (!redis) return null;
  try {
    const key = `session:${userId}`;
    const data = await redis.get<string>(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.warn(`Failed to get user session:`, error);
    return null;
  }
}

/**
 * Get Redis connection stats (for monitoring)
 */
export function getRedisStatus(): { available: boolean; url?: string } {
  return {
    available: isRedisAvailable(),
    url: redisUrl ? '[CONFIGURED]' : '[NOT CONFIGURED]',
  };
}
