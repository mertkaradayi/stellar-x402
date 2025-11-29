/**
 * Redis-Backed Replay Protection Store
 *
 * Provides persistent storage for settlement records and replay protection.
 * Falls back to in-memory storage if Redis is not connected.
 */

import type { SettleResponse } from "../types/index.js";
import { getRedisClient, isRedisConnected } from "./redis.js";

// TTL for settlement records (30 days in seconds)
const SETTLEMENT_TTL_SECONDS = 30 * 24 * 60 * 60;

// Redis key prefixes
const KEY_PREFIX = "x402:settlement:";

interface SettlementRecord {
  txHash: string;
  resource: string;
  settledAt: string; // ISO date string for JSON serialization
  response: SettleResponse;
}

// In-memory fallback store (used when Redis is not available)
const memoryStore = new Map<string, SettlementRecord>();

/**
 * Get Redis key for a transaction hash
 */
function getRedisKey(txHash: string): string {
  return `${KEY_PREFIX}${txHash}`;
}

/**
 * Check if a transaction has already been used for any resource
 */
export async function hasTransactionBeenUsed(txHash: string): Promise<boolean> {
  if (isRedisConnected()) {
    const client = getRedisClient();
    if (client) {
      try {
        const exists = await client.exists(getRedisKey(txHash));
        return exists === 1;
      } catch (error) {
        console.error("[replay-store] Redis error in hasTransactionBeenUsed:", error);
        // Fall through to memory store
      }
    }
  }

  // Fallback to memory store
  return memoryStore.has(txHash);
}

/**
 * Check if a transaction has been used for a specific resource
 */
export async function hasPaymentBeenUsedForResource(
  txHash: string,
  resource: string
): Promise<boolean> {
  const record = await getSettlementRecord(txHash);
  if (!record) return false;
  return record.resource === resource;
}

/**
 * Get the full settlement record for a transaction
 */
async function getSettlementRecord(txHash: string): Promise<SettlementRecord | null> {
  if (isRedisConnected()) {
    const client = getRedisClient();
    if (client) {
      try {
        const data = await client.get(getRedisKey(txHash));
        if (data) {
          return JSON.parse(data) as SettlementRecord;
        }
        return null;
      } catch (error) {
        console.error("[replay-store] Redis error in getSettlementRecord:", error);
        // Fall through to memory store
      }
    }
  }

  // Fallback to memory store
  return memoryStore.get(txHash) || null;
}

/**
 * Get the cached settlement result for a transaction
 * Enables idempotent /settle calls
 */
export async function getCachedSettlement(txHash: string): Promise<SettleResponse | null> {
  const record = await getSettlementRecord(txHash);
  return record ? record.response : null;
}

/**
 * Get the resource that a transaction was used for
 */
export async function getResourceForTransaction(txHash: string): Promise<string | null> {
  const record = await getSettlementRecord(txHash);
  return record ? record.resource : null;
}

/**
 * Mark a payment as used and cache the settlement result
 */
export async function markPaymentAsSettled(
  txHash: string,
  resource: string,
  response: SettleResponse
): Promise<void> {
  const record: SettlementRecord = {
    txHash,
    resource,
    settledAt: new Date().toISOString(),
    response,
  };

  if (isRedisConnected()) {
    const client = getRedisClient();
    if (client) {
      try {
        await client.setEx(
          getRedisKey(txHash),
          SETTLEMENT_TTL_SECONDS,
          JSON.stringify(record)
        );
        console.log(
          `[replay-store] Marked payment as settled in Redis: ${txHash.slice(0, 16)}... for resource: ${resource}`
        );
        return;
      } catch (error) {
        console.error("[replay-store] Redis error in markPaymentAsSettled:", error);
        // Fall through to memory store
      }
    }
  }

  // Fallback to memory store
  memoryStore.set(txHash, record);
  console.log(
    `[replay-store] Marked payment as settled in memory: ${txHash.slice(0, 16)}... for resource: ${resource}`
  );
  console.warn("[replay-store] ⚠️ Using in-memory storage - data will be lost on restart");
}

/**
 * Get statistics about the replay protection store
 */
export async function getStats(): Promise<{
  totalSettled: number;
  storageType: "redis" | "memory";
}> {
  if (isRedisConnected()) {
    const client = getRedisClient();
    if (client) {
      try {
        // Count keys matching our prefix
        const keys = await client.keys(`${KEY_PREFIX}*`);
        return {
          totalSettled: keys.length,
          storageType: "redis",
        };
      } catch (error) {
        console.error("[replay-store] Redis error in getStats:", error);
      }
    }
  }

  return {
    totalSettled: memoryStore.size,
    storageType: "memory",
  };
}

/**
 * Clear all cached settlements (useful for testing)
 */
export async function clearCache(): Promise<void> {
  if (isRedisConnected()) {
    const client = getRedisClient();
    if (client) {
      try {
        const keys = await client.keys(`${KEY_PREFIX}*`);
        if (keys.length > 0) {
          await client.del(keys);
        }
        console.log("[replay-store] Redis cache cleared");
        return;
      } catch (error) {
        console.error("[replay-store] Redis error in clearCache:", error);
      }
    }
  }

  memoryStore.clear();
  console.log("[replay-store] Memory cache cleared");
}

