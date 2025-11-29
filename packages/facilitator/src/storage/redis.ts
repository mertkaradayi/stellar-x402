/**
 * Redis Connection Module
 * 
 * Manages connection to Redis for persistent storage of settlement records
 * and replay protection.
 */

import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;
let isConnected = false;

/**
 * Get or create Redis client instance
 */
export function getRedisClient(): RedisClientType | null {
  return redisClient;
}

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient?.isOpen === true;
}

/**
 * Initialize Redis connection
 */
export async function connectRedis(): Promise<void> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn("[redis] REDIS_URL not set, Redis connection skipped");
    return;
  }

  try {
    redisClient = createClient({
      url: redisUrl,
    });

    redisClient.on("error", (err: Error) => {
      console.error("[redis] Client Error:", err);
      isConnected = false;
    });

    redisClient.on("connect", () => {
      console.log("[redis] Connecting...");
    });

    redisClient.on("ready", () => {
      console.log("[redis] ✅ Connected and ready");
      isConnected = true;
    });

    redisClient.on("reconnecting", () => {
      console.log("[redis] Reconnecting...");
      isConnected = false;
    });

    redisClient.on("end", () => {
      console.log("[redis] Connection ended");
      isConnected = false;
    });

    await redisClient.connect();
    console.log("[redis] ✅ Successfully connected to Redis");
  } catch (error) {
    console.error("[redis] ❌ Failed to connect:", error);
    isConnected = false;
    // Don't throw - allow app to continue without Redis
    // In production, you might want to fail fast
  }
}

/**
 * Disconnect Redis connection gracefully
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    try {
      await redisClient.quit();
      console.log("[redis] Disconnected gracefully");
    } catch (error) {
      console.error("[redis] Error during disconnect:", error);
      // Force disconnect if quit fails
      await redisClient.disconnect();
    }
    isConnected = false;
  }
}

/**
 * Test Redis connection by performing a simple PING
 */
export async function testRedisConnection(): Promise<boolean> {
  if (!redisClient || !redisClient.isOpen) {
    console.log("[redis] Client not connected, skipping test");
    return false;
  }

  try {
    const result = await redisClient.ping();
    if (result === "PONG") {
      console.log("[redis] ✅ Connection test successful (PONG)");
      return true;
    }
    return false;
  } catch (error) {
    console.error("[redis] ❌ Connection test failed:", error);
    return false;
  }
}

