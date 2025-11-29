/**
 * x402-stellar-client - Client SDK for signing Stellar x402 payments
 *
 * This package provides:
 * - createPaymentHeader: Main entry point for creating signed X-PAYMENT headers
 * - createPaymentPayload: Create signed PaymentPayload objects
 * - preparePaymentHeader: Build unsigned transactions
 * - signPaymentHeader: Sign transactions with Keypair or Freighter
 * - selectPaymentRequirements: Choose from multiple payment options
 * - Signer types and utilities for Keypair and Freighter
 */

// Main entry points
export {
  createPaymentHeader,
  createPaymentPayload,
  type CreatePaymentHeaderOptions,
} from "./createPaymentHeader.js";

export {
  preparePaymentHeader,
  type PreparePaymentOptions,
  type UnsignedPaymentPayload,
} from "./preparePaymentHeader.js";

export { signPaymentHeader } from "./signPaymentHeader.js";

export {
  selectPaymentRequirements,
  selectPaymentRequirementsWithPreference,
  type PaymentRequirementsSelector,
} from "./selectPaymentRequirements.js";

// Signer types and utilities
export {
  type StellarSigner,
  type KeypairSigner,
  type FreighterSigner,
  createKeypairSigner,
  createFreighterSigner,
  isKeypairSigner,
  isFreighterSigner,
} from "./types.js";

// Re-export useful types from x402-stellar
export type {
  PaymentPayload,
  PaymentRequirements,
  StellarPayload,
  StellarNetwork,
} from "x402-stellar";

