/**
 * Create Payment Header
 *
 * Main entry point for creating a signed x402 payment header.
 */

import {
  type PaymentRequirements,
  type PaymentPayload,
  encodePaymentHeader,
} from "x402-stellar";
import type { StellarSigner } from "./types.js";
import { isKeypairSigner, isFreighterSigner } from "./types.js";
import { getPublicKeyFromKeypair } from "./signers/keypair.js";
import { getFreighterPublicKey } from "./signers/freighter.js";
import { preparePaymentHeader } from "./preparePaymentHeader.js";
import { signPaymentHeader } from "./signPaymentHeader.js";

/**
 * Options for creating a payment header
 */
export interface CreatePaymentHeaderOptions {
  /** The signer to use (keypair or Freighter) */
  signer: StellarSigner;
  /** The x402 version (default: 1) */
  x402Version?: number;
  /** The payment requirements from the 402 response */
  paymentRequirements: PaymentRequirements;
  /** Optional timeout in seconds */
  timeoutSeconds?: number;
}

/**
 * Create a signed x402 payment header
 *
 * This is the main entry point for creating payment headers. It:
 * 1. Gets the source account from the signer
 * 2. Prepares the unsigned transaction
 * 3. Signs the transaction
 * 4. Encodes the payload as base64
 *
 * @param options - Options for creating the payment header
 * @returns The base64-encoded payment header (X-PAYMENT value)
 *
 * @example
 * ```typescript
 * // With keypair
 * const xPayment = await createPaymentHeader({
 *   signer: { type: "keypair", keypair: Stellar.Keypair.fromSecret("SXXX...") },
 *   paymentRequirements: requirements,
 * });
 *
 * // With Freighter
 * const xPayment = await createPaymentHeader({
 *   signer: { type: "freighter" },
 *   paymentRequirements: requirements,
 * });
 *
 * // Use in request
 * fetch("/api/premium", {
 *   headers: { "X-PAYMENT": xPayment }
 * });
 * ```
 */
export async function createPaymentHeader(
  options: CreatePaymentHeaderOptions
): Promise<string> {
  const { signer, x402Version = 1, paymentRequirements, timeoutSeconds } = options;

  // Validate x402Version
  if (x402Version !== 1) {
    throw new Error(`Unsupported x402Version: ${x402Version}`);
  }

  // Get the source account (public key) from the signer
  let sourceAccount: string;

  if (isKeypairSigner(signer)) {
    sourceAccount = getPublicKeyFromKeypair(signer);
  } else if (isFreighterSigner(signer)) {
    sourceAccount = await getFreighterPublicKey();
  } else {
    throw new Error("Unknown signer type");
  }

  // Prepare the unsigned payload
  const unsignedPayload = await preparePaymentHeader({
    sourceAccount,
    paymentRequirements,
    timeoutSeconds,
  });

  // Sign the payload
  const signedPayload = await signPaymentHeader(unsignedPayload, signer);

  // Encode as base64
  return encodePaymentHeader(signedPayload);
}

/**
 * Create a signed payment payload (without base64 encoding)
 *
 * Use this if you need the raw PaymentPayload object instead of the encoded header.
 *
 * @param options - Options for creating the payment payload
 * @returns The signed payment payload
 */
export async function createPaymentPayload(
  options: CreatePaymentHeaderOptions
): Promise<PaymentPayload> {
  const { signer, paymentRequirements, timeoutSeconds } = options;
  // x402Version is validated by the schemas, not used directly here

  // Get the source account (public key) from the signer
  let sourceAccount: string;

  if (isKeypairSigner(signer)) {
    sourceAccount = getPublicKeyFromKeypair(signer);
  } else if (isFreighterSigner(signer)) {
    sourceAccount = await getFreighterPublicKey();
  } else {
    throw new Error("Unknown signer type");
  }

  // Prepare the unsigned payload
  const unsignedPayload = await preparePaymentHeader({
    sourceAccount,
    paymentRequirements,
    timeoutSeconds,
  });

  // Sign and return the payload
  return signPaymentHeader(unsignedPayload, signer);
}

