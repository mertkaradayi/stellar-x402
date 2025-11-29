/**
 * Live Stellar Integration Tests
 * 
 * These tests use a real funded testnet account to verify the full x402 flow
 * with actual Stellar network calls.
 * 
 * Requirements:
 * - TEST_STELLAR_SECRET_KEY must be set in .env
 * - TEST_STELLAR_PUBLIC_KEY must be set in .env
 * - Account must be funded on Stellar testnet
 * 
 * Run with: pnpm test -- --testPathPattern=live-stellar
 */

import "dotenv/config";
import request from "supertest";
import * as Stellar from "@stellar/stellar-sdk";
import {
  createTestApp,
  createPaymentRequirements,
  createFacilitatorRequest,
  TEST_NETWORK,
  TEST_NETWORK_PASSPHRASE,
  TEST_HORIZON_URL,
} from "./helpers.js";
import { clearCache } from "../storage/replay-store.js";
import type { Express } from "express";
import type { PaymentPayload, StellarPayload } from "../types.js";

// Skip all tests if test account is not configured
const TEST_SECRET_KEY = process.env.TEST_STELLAR_SECRET_KEY;
const TEST_PUBLIC_KEY = process.env.TEST_STELLAR_PUBLIC_KEY;

// Fixed destination address (merchant wallet that receives payments)
const DESTINATION_ADDRESS = "GC63PSERYMUUUJKYSSFQ7FKRAU5UPIP3XUC6X7DLMZUB7SSCPW5BSIRT";

const describeIfConfigured = TEST_SECRET_KEY && TEST_PUBLIC_KEY 
  ? describe 
  : describe.skip;

describeIfConfigured("Live Stellar Integration Tests", () => {
  let app: Express;
  let testKeypair: Stellar.Keypair;

  beforeAll(async () => {
    app = await createTestApp();
    testKeypair = Stellar.Keypair.fromSecret(TEST_SECRET_KEY!);
    
    console.log("[live-test] Using test account (payer):", testKeypair.publicKey());
    console.log("[live-test] Destination account (merchant):", DESTINATION_ADDRESS);
  });

  beforeEach(async () => {
    await clearCache();
  });

  /**
   * Helper to create a real signed Stellar transaction
   * Uses payment operation to send XLM to the destination
   */
  async function createRealSignedTransaction(
    amount: string,
    destination: string
  ): Promise<{ signedTxXdr: string; txHash: string }> {
    const server = new Stellar.Horizon.Server(TEST_HORIZON_URL);
    const account = await server.loadAccount(testKeypair.publicKey());

    const amountXlm = (parseInt(amount) / 10_000_000).toFixed(7);

    const transaction = new Stellar.TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: TEST_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Stellar.Operation.payment({
          destination,
          asset: Stellar.Asset.native(),
          amount: amountXlm,
        })
      )
      .setTimeout(300)
      .build();

    transaction.sign(testKeypair);
    
    return {
      signedTxXdr: transaction.toXDR(),
      txHash: transaction.hash().toString("hex"),
    };
  }

  /**
   * Helper to create a complete payment payload with real transaction
   */
  async function createRealPaymentPayload(
    amount: string,
    destination: string
  ): Promise<{ paymentHeader: string; paymentPayload: PaymentPayload; txHash: string }> {
    const { signedTxXdr, txHash } = await createRealSignedTransaction(amount, destination);

    const stellarPayload: StellarPayload = {
      signedTxXdr,
      sourceAccount: testKeypair.publicKey(),
      amount,
      destination,
      asset: "native",
      validUntilLedger: 999999999,
      nonce: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
    };

    const paymentPayload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: TEST_NETWORK,
      payload: stellarPayload,
    };

    const paymentHeader = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");

    return { paymentHeader, paymentPayload, txHash };
  }

  describe("Account Verification", () => {
    it("should confirm test account exists and is funded", async () => {
      const server = new Stellar.Horizon.Server(TEST_HORIZON_URL);
      const account = await server.loadAccount(testKeypair.publicKey());
      
      const xlmBalance = account.balances.find(b => b.asset_type === "native");
      expect(xlmBalance).toBeDefined();
      
      const balance = parseFloat(xlmBalance!.balance);
      console.log(`[live-test] Test account XLM balance: ${balance}`);
      expect(balance).toBeGreaterThan(0);
    });
  });

  describe("/verify with Real Transaction", () => {
    it("should return isValid: true for valid payment with funded account", async () => {
      const paymentRequirements = createPaymentRequirements({
        payTo: DESTINATION_ADDRESS,
        maxAmountRequired: "1000000", // 0.1 XLM in stroops
        asset: "native",
      });

      const { paymentHeader } = await createRealPaymentPayload(
        "1000000", // 0.1 XLM
        DESTINATION_ADDRESS
      );

      const response = await request(app)
        .post("/verify")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] /verify response:", response.body);

      expect(response.body.isValid).toBe(true);
      expect(response.body.invalidReason).toBeNull();
    });

    it("should reject insufficient amount", async () => {
      const paymentRequirements = createPaymentRequirements({
        payTo: DESTINATION_ADDRESS,
        maxAmountRequired: "10000000", // 1 XLM required
        asset: "native",
      });

      const { paymentHeader } = await createRealPaymentPayload(
        "1000000", // Only 0.1 XLM (less than required)
        DESTINATION_ADDRESS
      );

      const response = await request(app)
        .post("/verify")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      expect(response.body.isValid).toBe(false);
      expect(response.body.invalidReason?.toLowerCase()).toContain("amount");
    });

    it("should reject destination mismatch", async () => {
      const wrongDestination = Stellar.Keypair.random().publicKey();
      
      const paymentRequirements = createPaymentRequirements({
        payTo: DESTINATION_ADDRESS, // Expected destination
        maxAmountRequired: "1000000",
        asset: "native",
      });

      const { paymentHeader } = await createRealPaymentPayload(
        "1000000",
        wrongDestination // Wrong destination in transaction
      );

      const response = await request(app)
        .post("/verify")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      expect(response.body.isValid).toBe(false);
      expect(response.body.invalidReason?.toLowerCase()).toContain("destination");
    });
  });

  describe("/settle with Real Transaction", () => {
    it("should successfully settle a valid payment", async () => {
      const paymentRequirements = createPaymentRequirements({
        payTo: DESTINATION_ADDRESS,
        maxAmountRequired: "1000000", // 0.1 XLM
        asset: "native",
      });

      const { paymentHeader, txHash } = await createRealPaymentPayload(
        "1000000", // 0.1 XLM
        DESTINATION_ADDRESS
      );

      console.log("[live-test] Settling transaction:", txHash.slice(0, 16) + "...");

      const response = await request(app)
        .post("/settle")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] /settle response:", response.body);

      expect(response.body.success).toBe(true);
      expect(response.body.error).toBeNull();
      expect(response.body.txHash).toBeTruthy();
      expect(response.body.networkId).toBe(TEST_NETWORK);
    }, 60000); // 60 second timeout for blockchain confirmation

    it("should return cached result for idempotent settle calls", async () => {
      const paymentRequirements = createPaymentRequirements({
        payTo: DESTINATION_ADDRESS,
        maxAmountRequired: "1000000", // 0.1 XLM
        asset: "native",
      });

      const { paymentHeader } = await createRealPaymentPayload(
        "1000000", // 0.1 XLM
        DESTINATION_ADDRESS
      );

      // First settle
      const response1 = await request(app)
        .post("/settle")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] First settle:", response1.body);

      // Second settle with same transaction (should return cached)
      const response2 = await request(app)
        .post("/settle")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] Second settle (cached):", response2.body);

      // Both should have same result
      expect(response2.body.txHash).toBe(response1.body.txHash);
      expect(response2.body.success).toBe(response1.body.success);
    }, 60000);
  });

  describe("Replay Protection with Real Transactions", () => {
    it("should reject already-used transaction on /verify", async () => {
      const paymentRequirements = createPaymentRequirements({
        payTo: DESTINATION_ADDRESS,
        maxAmountRequired: "1000000", // 0.1 XLM
        asset: "native",
      });

      const { paymentHeader } = await createRealPaymentPayload(
        "1000000", // 0.1 XLM
        DESTINATION_ADDRESS
      );

      // First: settle the transaction
      const settleResponse = await request(app)
        .post("/settle")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] Initial settle:", settleResponse.body);

      // Second: try to verify the same transaction again
      const verifyResponse = await request(app)
        .post("/verify")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] Verify after settle:", verifyResponse.body);

      expect(verifyResponse.body.isValid).toBe(false);
      expect(verifyResponse.body.invalidReason).toContain("already been used");
    }, 60000);
  });

  describe("Full x402 Flow with Real Transactions", () => {
    it("should complete full verify -> settle flow", async () => {
      const paymentRequirements = createPaymentRequirements({
        payTo: DESTINATION_ADDRESS,
        maxAmountRequired: "1000000", // 0.1 XLM
        asset: "native",
      });

      const { paymentHeader, txHash } = await createRealPaymentPayload(
        "1000000", // 0.1 XLM
        DESTINATION_ADDRESS
      );

      console.log("[live-test] Starting full flow for tx:", txHash.slice(0, 16) + "...");

      // Step 1: Verify
      const verifyResponse = await request(app)
        .post("/verify")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] Step 1 - Verify:", verifyResponse.body);
      expect(verifyResponse.body.isValid).toBe(true);

      // Step 2: Settle
      const settleResponse = await request(app)
        .post("/settle")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] Step 2 - Settle:", settleResponse.body);
      expect(settleResponse.body.success).toBe(true);
      expect(settleResponse.body.txHash).toBeTruthy();

      // Step 3: Verify again (should fail - replay protection)
      const verifyAgainResponse = await request(app)
        .post("/verify")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] Step 3 - Verify again:", verifyAgainResponse.body);
      expect(verifyAgainResponse.body.isValid).toBe(false);
      expect(verifyAgainResponse.body.invalidReason).toContain("already been used");

      // Step 4: Settle again (should return cached - idempotent)
      const settleAgainResponse = await request(app)
        .post("/settle")
        .send(createFacilitatorRequest(paymentHeader, paymentRequirements))
        .expect(200);

      console.log("[live-test] Step 4 - Settle again (idempotent):", settleAgainResponse.body);
      expect(settleAgainResponse.body.txHash).toBe(settleResponse.body.txHash);
    }, 120000); // 2 minute timeout for full flow
  });
});

// Log if tests are skipped
if (!TEST_SECRET_KEY || !TEST_PUBLIC_KEY) {
  console.log("\n⚠️  Live Stellar tests SKIPPED - TEST_STELLAR_SECRET_KEY or TEST_STELLAR_PUBLIC_KEY not set\n");
}

