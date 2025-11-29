/**
 * Unit Tests: Replay Store
 * 
 * Tests the Redis-backed storage with in-memory fallback for:
 * - hasTransactionBeenUsed()
 * - getCachedSettlement()
 * - markPaymentAsSettled()
 * - getResourceForTransaction()
 * - Fallback to memory when Redis unavailable
 */

import {
  hasTransactionBeenUsed,
  getCachedSettlement,
  markPaymentAsSettled,
  getResourceForTransaction,
  getStats,
  clearCache,
} from "../storage/replay-store.js";
import { createMockSettleResponse, TEST_NETWORK } from "./helpers.js";

describe("Replay Store", () => {
  // Clear cache before each test to ensure isolation
  beforeEach(async () => {
    await clearCache();
  });

  describe("hasTransactionBeenUsed()", () => {
    it("should return false for a new transaction", async () => {
      const txHash = "new-transaction-hash-123";
      const result = await hasTransactionBeenUsed(txHash);
      expect(result).toBe(false);
    });

    it("should return true for an existing transaction", async () => {
      const txHash = "existing-transaction-hash-456";
      const resource = "/api/content";
      const response = createMockSettleResponse();

      await markPaymentAsSettled(txHash, resource, response);
      const result = await hasTransactionBeenUsed(txHash);
      
      expect(result).toBe(true);
    });

    it("should handle multiple different transactions", async () => {
      const txHash1 = "transaction-1";
      const txHash2 = "transaction-2";
      const txHash3 = "transaction-3";
      const resource = "/api/content";
      const response = createMockSettleResponse();

      // Mark only txHash1 and txHash2 as used
      await markPaymentAsSettled(txHash1, resource, response);
      await markPaymentAsSettled(txHash2, resource, response);

      expect(await hasTransactionBeenUsed(txHash1)).toBe(true);
      expect(await hasTransactionBeenUsed(txHash2)).toBe(true);
      expect(await hasTransactionBeenUsed(txHash3)).toBe(false);
    });
  });

  describe("getCachedSettlement()", () => {
    it("should return null for a new transaction", async () => {
      const txHash = "uncached-transaction-hash";
      const result = await getCachedSettlement(txHash);
      expect(result).toBeNull();
    });

    it("should return cached response for existing transaction", async () => {
      const txHash = "cached-transaction-hash";
      const resource = "/api/content";
      const response = createMockSettleResponse({
        transaction: "abc123def456",
        network: TEST_NETWORK,
      });

      await markPaymentAsSettled(txHash, resource, response);
      const cached = await getCachedSettlement(txHash);

      expect(cached).not.toBeNull();
      expect(cached?.success).toBe(true);
      expect(cached?.transaction).toBe("abc123def456");
      expect(cached?.network).toBe(TEST_NETWORK);
    });

    it("should return exact same response object structure", async () => {
      const txHash = "exact-response-test";
      const resource = "/api/premium";
      const response = createMockSettleResponse({
        success: true,
        transaction: "exacthash123",
        network: TEST_NETWORK,
      });

      await markPaymentAsSettled(txHash, resource, response);
      const cached = await getCachedSettlement(txHash);

      // Verify x402 spec format: { success, errorReason?, payer?, transaction, network }
      expect(cached?.success).toBe(true);
      expect(cached?.transaction).toBe("exacthash123");
      expect(cached?.network).toBe(TEST_NETWORK);
    });
  });

  describe("markPaymentAsSettled()", () => {
    it("should store settlement and make it retrievable", async () => {
      const txHash = "store-test-hash";
      const resource = "/api/data";
      const response = createMockSettleResponse();

      await markPaymentAsSettled(txHash, resource, response);

      expect(await hasTransactionBeenUsed(txHash)).toBe(true);
      expect(await getCachedSettlement(txHash)).not.toBeNull();
      expect(await getResourceForTransaction(txHash)).toBe(resource);
    });

    it("should handle failed settlement responses", async () => {
      const txHash = "failed-settlement-hash";
      const resource = "/api/content";
      const response = createMockSettleResponse({
        success: false,
        errorReason: "Transaction failed",
        transaction: "",
        network: "",
      });

      await markPaymentAsSettled(txHash, resource, response);
      const cached = await getCachedSettlement(txHash);

      expect(cached?.success).toBe(false);
      expect(cached?.errorReason).toBe("Transaction failed");
      expect(cached?.transaction).toBe("");
      expect(cached?.network).toBe("");
    });

    it("should overwrite existing settlement for same txHash", async () => {
      const txHash = "overwrite-test-hash";
      const resource1 = "/api/content1";
      const resource2 = "/api/content2";
      const response1 = createMockSettleResponse({ transaction: "hash1" });
      const response2 = createMockSettleResponse({ transaction: "hash2" });

      await markPaymentAsSettled(txHash, resource1, response1);
      await markPaymentAsSettled(txHash, resource2, response2);

      const cached = await getCachedSettlement(txHash);
      expect(cached?.transaction).toBe("hash2");
      expect(await getResourceForTransaction(txHash)).toBe(resource2);
    });
  });

  describe("getResourceForTransaction()", () => {
    it("should return null for unknown transaction", async () => {
      const result = await getResourceForTransaction("unknown-tx-hash");
      expect(result).toBeNull();
    });

    it("should return correct resource for known transaction", async () => {
      const txHash = "resource-test-hash";
      const resource = "/api/premium-content";
      const response = createMockSettleResponse();

      await markPaymentAsSettled(txHash, resource, response);
      const result = await getResourceForTransaction(txHash);

      expect(result).toBe(resource);
    });

    it("should handle different resources for different transactions", async () => {
      const tx1 = "tx-for-content";
      const tx2 = "tx-for-data";
      const resource1 = "/api/content";
      const resource2 = "/api/data";
      const response = createMockSettleResponse();

      await markPaymentAsSettled(tx1, resource1, response);
      await markPaymentAsSettled(tx2, resource2, response);

      expect(await getResourceForTransaction(tx1)).toBe(resource1);
      expect(await getResourceForTransaction(tx2)).toBe(resource2);
    });
  });

  describe("getStats()", () => {
    it("should return zero for empty cache", async () => {
      const stats = await getStats();
      expect(stats.totalSettled).toBe(0);
      expect(["redis", "memory"]).toContain(stats.storageType);
    });

    it("should return correct count after adding settlements", async () => {
      const response = createMockSettleResponse();
      
      await markPaymentAsSettled("tx1", "/api/1", response);
      await markPaymentAsSettled("tx2", "/api/2", response);
      await markPaymentAsSettled("tx3", "/api/3", response);

      const stats = await getStats();
      expect(stats.totalSettled).toBe(3);
    });
  });

  describe("clearCache()", () => {
    it("should remove all cached settlements", async () => {
      const response = createMockSettleResponse();
      
      await markPaymentAsSettled("clear-tx1", "/api/1", response);
      await markPaymentAsSettled("clear-tx2", "/api/2", response);

      // Verify they exist
      expect(await hasTransactionBeenUsed("clear-tx1")).toBe(true);
      expect(await hasTransactionBeenUsed("clear-tx2")).toBe(true);

      // Clear cache
      await clearCache();

      // Verify they're gone
      expect(await hasTransactionBeenUsed("clear-tx1")).toBe(false);
      expect(await hasTransactionBeenUsed("clear-tx2")).toBe(false);
    });
  });

  describe("Idempotency Support", () => {
    it("should enable idempotent settle calls by returning cached result", async () => {
      const txHash = "idempotent-tx-hash";
      const resource = "/api/content";
      const originalResponse = createMockSettleResponse({
        success: true,
        transaction: "original-hash-abc123",
        network: TEST_NETWORK,
      });

      // First settlement
      await markPaymentAsSettled(txHash, resource, originalResponse);

      // Simulate second call - should return cached result
      const cachedResult = await getCachedSettlement(txHash);
      
      expect(cachedResult).toEqual(originalResponse);
    });
  });

  describe("Replay Protection Support", () => {
    it("should detect transaction reuse for different resource", async () => {
      const txHash = "replay-test-tx";
      const resource1 = "/api/content";
      const resource2 = "/api/other-content";
      const response = createMockSettleResponse();

      // Use transaction for resource1
      await markPaymentAsSettled(txHash, resource1, response);

      // Check if transaction was used
      const wasUsed = await hasTransactionBeenUsed(txHash);
      const usedForResource = await getResourceForTransaction(txHash);

      expect(wasUsed).toBe(true);
      expect(usedForResource).toBe(resource1);
      expect(usedForResource).not.toBe(resource2);
    });
  });
});
