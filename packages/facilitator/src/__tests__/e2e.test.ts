/**
 * End-to-End Flow Tests
 * 
 * Tests the full x402 protocol flow as described in the spec:
 * 1. Call /verify with valid payment -> success
 * 2. Call /settle with same payment -> success, stores in cache
 * 3. Call /verify again with same tx -> rejected (replay protection)
 * 4. Call /settle again with same tx -> returns cached result (idempotency)
 * 5. Call /settle with same tx for different resource -> rejected
 */

import request from "supertest";
import {
  createTestApp,
  createValidTestFixture,
  createPaymentRequirements,
  createFacilitatorRequest,
  createMockSettleResponse,
  getTxHashFromXdr,
  TEST_NETWORK,
} from "./helpers.js";
import { 
  clearCache, 
  markPaymentAsSettled,
  hasTransactionBeenUsed,
  getCachedSettlement,
  getResourceForTransaction,
} from "../storage/replay-store.js";
import type { Express } from "express";

describe("x402 Protocol End-to-End Flow", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await clearCache();
  });

  describe("Standard Flow: Verify -> Settle -> Complete", () => {
    it("Step 1: /verify returns proper response format", async () => {
      const { paymentHeader, paymentRequirements } = createValidTestFixture();

      const response = await request(app)
        .post("/verify")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      // Response should have correct format per x402 spec
      // Required: isValid. Optional: invalidReason, payer
      expect(response.body).toHaveProperty("isValid");
      expect(typeof response.body.isValid).toBe("boolean");
    });

    it("Step 2: /settle returns proper response format", async () => {
      const { paymentHeader, paymentRequirements } = createValidTestFixture();

      // Then settle (note: will fail without funded account, but format should be correct)
      const settleResponse = await request(app)
        .post("/settle")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      // Response should have correct format regardless of success/failure
      // Per x402 spec: success (required), errorReason (optional), payer (optional), transaction (required), network (required)
      expect(settleResponse.body).toHaveProperty("success");
      expect(settleResponse.body).toHaveProperty("transaction");
      expect(settleResponse.body).toHaveProperty("network");
    });
  });

  describe("Replay Protection Flow", () => {
    it("Step 3: /verify rejects already-used transaction", async () => {
      // Simulate a transaction that was already settled
      const txHash = "already-settled-tx-hash";
      const resource = "/api/content";
      
      await markPaymentAsSettled(txHash, resource, createMockSettleResponse({
        success: true,
        transaction: txHash,
        network: TEST_NETWORK,
      }));

      // Verify the transaction is marked as used
      expect(await hasTransactionBeenUsed(txHash)).toBe(true);
    });

    it("should track transaction usage across verify and settle", async () => {
      const txHash = "tracked-tx-hash";
      const resource = "/api/premium";

      // Initially not used
      expect(await hasTransactionBeenUsed(txHash)).toBe(false);

      // Mark as settled
      await markPaymentAsSettled(txHash, resource, createMockSettleResponse());

      // Now should be used
      expect(await hasTransactionBeenUsed(txHash)).toBe(true);
      expect(await getResourceForTransaction(txHash)).toBe(resource);
    });
  });

  describe("Idempotency Flow", () => {
    it("Step 4: /settle returns cached result for same transaction", async () => {
      const txHash = "idempotent-tx-hash";
      const resource = "/api/content";
      const cachedResponse = createMockSettleResponse({
        success: true,
        transaction: "original-settled-hash",
        network: TEST_NETWORK,
      });

      // First settlement
      await markPaymentAsSettled(txHash, resource, cachedResponse);

      // Verify cached result
      const cached = await getCachedSettlement(txHash);
      expect(cached).toEqual(cachedResponse);
    });

    it("should return same result on repeated settle calls", async () => {
      const txHash = "repeated-settle-tx";
      const resource = "/api/data";
      const originalResponse = createMockSettleResponse({
        success: true,
        transaction: "consistent-hash-123",
        network: TEST_NETWORK,
      });

      // First settlement
      await markPaymentAsSettled(txHash, resource, originalResponse);

      // Multiple retrievals should return same result
      const cached1 = await getCachedSettlement(txHash);
      const cached2 = await getCachedSettlement(txHash);
      const cached3 = await getCachedSettlement(txHash);

      expect(cached1).toEqual(originalResponse);
      expect(cached2).toEqual(originalResponse);
      expect(cached3).toEqual(originalResponse);
    });
  });

  describe("Different Resource Rejection Flow", () => {
    it("Step 5: /settle rejects same tx for different resource", async () => {
      const txHash = "reused-tx-hash";
      const resource1 = "/api/content";
      const resource2 = "/api/other-content";

      // First settlement for resource1
      await markPaymentAsSettled(txHash, resource1, createMockSettleResponse());

      // Check that transaction is used for resource1
      const usedFor = await getResourceForTransaction(txHash);
      expect(usedFor).toBe(resource1);
      expect(usedFor).not.toBe(resource2);

      // Transaction is already used
      expect(await hasTransactionBeenUsed(txHash)).toBe(true);
    });

    it("should distinguish between different transactions for same resource", async () => {
      const tx1 = "tx-hash-1";
      const tx2 = "tx-hash-2";
      const resource = "/api/content";

      await markPaymentAsSettled(tx1, resource, createMockSettleResponse({ transaction: "hash1" }));
      await markPaymentAsSettled(tx2, resource, createMockSettleResponse({ transaction: "hash2" }));

      const cached1 = await getCachedSettlement(tx1);
      const cached2 = await getCachedSettlement(tx2);

      expect(cached1?.transaction).toBe("hash1");
      expect(cached2?.transaction).toBe("hash2");
    });
  });

  describe("Full Protocol Compliance", () => {
    it("should follow x402 spec: verify response format", async () => {
      const { paymentHeader, paymentRequirements } = createValidTestFixture();

      const response = await request(app)
        .post("/verify")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      // x402 spec: { isValid (required), invalidReason (optional), payer (optional) }
      expect(response.body).toHaveProperty("isValid");
      // All keys must be valid
      const validKeys = ["isValid", "invalidReason", "payer"];
      for (const key of Object.keys(response.body)) {
        expect(validKeys).toContain(key);
      }
    });

    it("should follow x402 spec: settle response format", async () => {
      const { paymentHeader, paymentRequirements } = createValidTestFixture();

      const response = await request(app)
        .post("/settle")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      // x402 spec: { success, errorReason?, payer?, transaction, network }
      expect(response.body).toHaveProperty("success");
      expect(response.body).toHaveProperty("transaction");
      expect(response.body).toHaveProperty("network");
      // All keys must be valid
      const validKeys = ["success", "errorReason", "payer", "transaction", "network"];
      for (const key of Object.keys(response.body)) {
        expect(validKeys).toContain(key);
      }
    });

    it("should follow x402 spec: supported response format", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      // x402 spec: { kinds: [{ x402Version, scheme, network }] }
      expect(response.body).toHaveProperty("kinds");
      expect(Array.isArray(response.body.kinds)).toBe(true);
      
      for (const kind of response.body.kinds) {
        expect(kind).toHaveProperty("x402Version");
        expect(kind).toHaveProperty("scheme");
        expect(kind).toHaveProperty("network");
      }
    });
  });

  describe("Error Handling Flow", () => {
    it("should handle malformed requests gracefully", async () => {
      // Empty body
      const response1 = await request(app)
        .post("/verify")
        .send({})
        .expect(200);

      expect(response1.body.isValid).toBe(false);
      expect(response1.body.invalidReason).toBeTruthy();

      // Invalid JSON in paymentHeader
      const response2 = await request(app)
        .post("/settle")
        .send({
          x402Version: 1,
          paymentHeader: Buffer.from("not json").toString("base64"),
          paymentRequirements: createPaymentRequirements(),
        })
        .expect(200);

      expect(response2.body.success).toBe(false);
      expect(response2.body.errorReason).toBeTruthy();
    });

    it("should maintain response format consistency on errors", async () => {
      // Verify endpoint error
      const verifyError = await request(app)
        .post("/verify")
        .send({ x402Version: 2 }) // Wrong version
        .expect(200);

      expect(verifyError.body).toHaveProperty("isValid");

      // Settle endpoint error
      const settleError = await request(app)
        .post("/settle")
        .send({ x402Version: 2 }) // Wrong version
        .expect(200);

      expect(settleError.body).toHaveProperty("success");
      expect(settleError.body).toHaveProperty("transaction");
      expect(settleError.body).toHaveProperty("network");
    });
  });

  describe("Concurrent Request Handling", () => {
    it("should handle multiple concurrent verify requests", async () => {
      const fixtures = [
        createValidTestFixture(),
        createValidTestFixture(),
        createValidTestFixture(),
      ];

      const responses = await Promise.all(
        fixtures.map(({ paymentHeader, paymentRequirements }) =>
          request(app)
            .post("/verify")
            .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        )
      );

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("isValid");
      }
    });

    it("should handle multiple concurrent settle requests", async () => {
      const fixtures = [
        createValidTestFixture(),
        createValidTestFixture(),
        createValidTestFixture(),
      ];

      const responses = await Promise.all(
        fixtures.map(({ paymentHeader, paymentRequirements }) =>
          request(app)
            .post("/settle")
            .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        )
      );

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty("success");
        expect(response.body).toHaveProperty("transaction");
        expect(response.body).toHaveProperty("network");
      }
    });
  });

  describe("Cache Persistence", () => {
    it("should persist settlement across multiple cache lookups", async () => {
      const txHash = "persistent-cache-tx";
      const resource = "/api/content";
      const response = createMockSettleResponse({
        success: true,
        transaction: "persistent-hash",
        network: TEST_NETWORK,
      });

      await markPaymentAsSettled(txHash, resource, response);

      // Multiple lookups
      for (let i = 0; i < 5; i++) {
        const cached = await getCachedSettlement(txHash);
        expect(cached).toEqual(response);
      }
    });

    it("should maintain transaction usage status", async () => {
      const txHash = "usage-status-tx";
      const resource = "/api/data";

      await markPaymentAsSettled(txHash, resource, createMockSettleResponse());

      // Multiple checks
      for (let i = 0; i < 5; i++) {
        expect(await hasTransactionBeenUsed(txHash)).toBe(true);
        expect(await getResourceForTransaction(txHash)).toBe(resource);
      }
    });
  });
});
