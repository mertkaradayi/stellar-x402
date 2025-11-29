/**
 * Test Helpers for x402 Facilitator Tests
 * 
 * Provides utilities for generating valid payloads, encoding headers,
 * and creating test fixtures that match the x402 specification.
 */

import * as Stellar from "@stellar/stellar-sdk";
import type { PaymentRequirements, StellarPayload, PaymentPayload, SettleResponse } from "../types/index.js";

// Test constants
export const TEST_NETWORK = "stellar-testnet";
export const TEST_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
export const TEST_HORIZON_URL = "https://horizon-testnet.stellar.org";

// Test accounts (these are random keypairs for testing - not real funded accounts)
export const TEST_SOURCE_KEYPAIR = Stellar.Keypair.random();
export const TEST_DESTINATION_KEYPAIR = Stellar.Keypair.random();

// USDC contract on testnet
export const TEST_ASSET_CONTRACT = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/**
 * Create valid PaymentRequirements matching x402 spec
 */
export function createPaymentRequirements(
  overrides: Partial<PaymentRequirements> = {}
): PaymentRequirements {
  return {
    scheme: "exact",
    network: TEST_NETWORK,
    maxAmountRequired: "1000000", // 0.1 in stroops (7 decimals)
    resource: "/api/content",
    description: "Test premium content",
    mimeType: "application/json",
    payTo: TEST_DESTINATION_KEYPAIR.publicKey(),
    maxTimeoutSeconds: 300,
    asset: TEST_ASSET_CONTRACT,
    extra: null,
    ...overrides,
  };
}

/**
 * Create valid StellarPayload for testing
 */
export function createStellarPayload(
  overrides: Partial<StellarPayload> = {}
): StellarPayload {
  return {
    signedTxXdr: "", // Will be set by createSignedTransaction
    sourceAccount: TEST_SOURCE_KEYPAIR.publicKey(),
    amount: "1000000", // 0.1 in stroops
    destination: TEST_DESTINATION_KEYPAIR.publicKey(),
    asset: TEST_ASSET_CONTRACT,
    validUntilLedger: 999999999,
    nonce: generateNonce(),
    ...overrides,
  };
}

/**
 * Create a valid PaymentPayload (the decoded X-PAYMENT header content)
 */
export function createPaymentPayload(
  stellarPayload: StellarPayload,
  overrides: Partial<Omit<PaymentPayload, "payload">> = {}
): PaymentPayload {
  return {
    x402Version: 1,
    scheme: "exact",
    network: TEST_NETWORK,
    payload: stellarPayload,
    ...overrides,
  };
}

/**
 * Encode a PaymentPayload as a base64 X-PAYMENT header
 */
export function encodePaymentHeader(payload: PaymentPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Create a signed Stellar transaction for testing
 * Note: This creates a real transaction structure but with test keypairs
 */
export function createSignedTransaction(
  sourceKeypair: Stellar.Keypair,
  destination: string,
  amount: string,
  asset: string = "native"
): string {
  // Create a minimal transaction for testing
  const account = new Stellar.Account(sourceKeypair.publicKey(), "0");
  
  let operation: Stellar.xdr.Operation;
  if (asset === "native") {
    operation = Stellar.Operation.payment({
      destination,
      asset: Stellar.Asset.native(),
      amount: (parseInt(amount) / 10_000_000).toFixed(7), // Convert stroops to XLM
    });
  } else {
    // For Soroban tokens, we'd need a different approach
    // For testing purposes, use native XLM
    operation = Stellar.Operation.payment({
      destination,
      asset: Stellar.Asset.native(),
      amount: (parseInt(amount) / 10_000_000).toFixed(7),
    });
  }

  const transaction = new Stellar.TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: TEST_NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(300)
    .build();

  transaction.sign(sourceKeypair);
  return transaction.toXDR();
}

/**
 * Create a complete valid test fixture with signed transaction
 */
export function createValidTestFixture(overrides: {
  paymentRequirements?: Partial<PaymentRequirements>;
  stellarPayload?: Partial<StellarPayload>;
  paymentPayload?: Partial<Omit<PaymentPayload, "payload">>;
} = {}): {
  paymentRequirements: PaymentRequirements;
  paymentPayload: PaymentPayload;
  paymentHeader: string;
  sourceKeypair: Stellar.Keypair;
} {
  const sourceKeypair = Stellar.Keypair.random();
  const destinationKeypair = Stellar.Keypair.random();

  const paymentRequirements = createPaymentRequirements({
    payTo: destinationKeypair.publicKey(),
    ...overrides.paymentRequirements,
  });

  const signedTxXdr = createSignedTransaction(
    sourceKeypair,
    paymentRequirements.payTo,
    paymentRequirements.maxAmountRequired,
    "native" // Use native for testing since Soroban requires more setup
  );

  const stellarPayload = createStellarPayload({
    signedTxXdr,
    sourceAccount: sourceKeypair.publicKey(),
    destination: paymentRequirements.payTo,
    amount: paymentRequirements.maxAmountRequired,
    asset: paymentRequirements.asset,
    ...overrides.stellarPayload,
  });

  const paymentPayload = createPaymentPayload(stellarPayload, overrides.paymentPayload);
  const paymentHeader = encodePaymentHeader(paymentPayload);

  return {
    paymentRequirements,
    paymentPayload,
    paymentHeader,
    sourceKeypair,
  };
}

/**
 * Generate a unique nonce for replay protection
 */
export function generateNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create a mock SettleResponse for testing
 * Per x402 spec: { success, errorReason?, payer?, transaction, network }
 */
export function createMockSettleResponse(
  overrides: Partial<SettleResponse> = {}
): SettleResponse {
  return {
    success: true,
    payer: TEST_SOURCE_KEYPAIR.publicKey(),
    transaction: `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`,
    network: TEST_NETWORK,
    ...overrides,
  };
}

/**
 * Get transaction hash from XDR
 */
export function getTxHashFromXdr(signedTxXdr: string): string {
  const tx = Stellar.TransactionBuilder.fromXDR(signedTxXdr, TEST_NETWORK_PASSPHRASE);
  return tx.hash().toString("hex");
}

/**
 * Create an Express app instance for testing
 */
export async function createTestApp(): Promise<import("express").Express> {
  const express = (await import("express")).default;
  const cors = (await import("cors")).default;
  const { verifyRoute } = await import("../routes/verify.js");
  const { settleRoute } = await import("../routes/settle.js");
  const { SUPPORTED_KINDS } = await import("../types/index.js");

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "x402-stellar-facilitator" });
  });

  // Per x402 spec: each kind must include x402Version, scheme, network, and optional extra
  app.get("/supported", (_req, res) => {
    res.json({
      kinds: SUPPORTED_KINDS.map((k) => ({ 
        x402Version: k.x402Version, 
        scheme: k.scheme, 
        network: k.network,
        extra: {
          feeSponsorship: false,
        },
      })),
    });
  });

  app.post("/verify", verifyRoute);
  app.post("/settle", settleRoute);

  return app;
}

/**
 * Create a FacilitatorRequest body for testing
 */
export function createFacilitatorRequest(
  paymentHeader: string,
  paymentRequirements: PaymentRequirements,
  x402Version: number = 1
) {
  return {
    x402Version,
    paymentHeader,
    paymentRequirements,
  };
}

