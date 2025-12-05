/**
 * Sign Payment Header
 *
 * Signs an unsigned payment payload using the provided signer.
 * Supports both XLM native (transaction signing) and SAC tokens (auth entry signing).
 */

import * as Stellar from "@stellar/stellar-sdk";
import { STELLAR_NETWORKS, type StellarNetworkId, type PaymentPayload } from "x402-stellar";
import type { StellarSigner } from "./types.js";
import type { UnsignedPaymentPayload, SacTokenPayload } from "./preparePaymentHeader.js";
import { isKeypairSigner, isFreighterSigner } from "./types.js";
import { signWithKeypair } from "./signers/keypair.js";
import { signWithFreighter } from "./signers/freighter.js";

/**
 * Type guard to check if payload is SAC token type
 */
function isSacTokenPayload(
  payload: UnsignedPaymentPayload | SacTokenPayload
): payload is SacTokenPayload {
  return "transaction" in payload.payload;
}

/**
 * Sign an unsigned payment payload
 *
 * @param unsignedPayload - The unsigned payment payload (XLM or SAC token)
 * @param signer - The signer to use (keypair or Freighter)
 * @returns The signed payment payload
 *
 * @example
 * ```typescript
 * // With keypair
 * const signedPayload = await signPaymentHeader(
 *   unsignedPayload,
 *   { type: "keypair", keypair: Stellar.Keypair.fromSecret("SXXX...") }
 * );
 *
 * // With Freighter
 * const signedPayload = await signPaymentHeader(
 *   unsignedPayload,
 *   { type: "freighter" }
 * );
 * ```
 */
export async function signPaymentHeader(
  unsignedPayload: UnsignedPaymentPayload | SacTokenPayload,
  signer: StellarSigner
): Promise<PaymentPayload> {
  const network = unsignedPayload.network as StellarNetworkId;
  const networkConfig = STELLAR_NETWORKS[network];

  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Handle SAC token payloads (already has auth entries, needs transaction signing)
  if (isSacTokenPayload(unsignedPayload)) {
    return signSacTokenPayload(unsignedPayload, signer, networkConfig);
  }

  // Handle XLM native payloads
  return signNativeXlmPayload(unsignedPayload, signer, networkConfig);
}

/**
 * Sign an XLM native payment payload
 */
async function signNativeXlmPayload(
  unsignedPayload: UnsignedPaymentPayload,
  signer: StellarSigner,
  networkConfig: (typeof STELLAR_NETWORKS)[StellarNetworkId]
): Promise<PaymentPayload> {
  let signedTxXdr: string;

  if (isKeypairSigner(signer)) {
    signedTxXdr = await signWithKeypair(
      unsignedPayload.payload.unsignedTxXdr,
      signer,
      networkConfig.networkPassphrase
    );
  } else if (isFreighterSigner(signer)) {
    signedTxXdr = await signWithFreighter(
      unsignedPayload.payload.unsignedTxXdr,
      networkConfig.networkPassphrase
    );
  } else {
    throw new Error("Unknown signer type");
  }

  return {
    x402Version: unsignedPayload.x402Version,
    scheme: unsignedPayload.scheme,
    network: unsignedPayload.network as "stellar-testnet" | "stellar",
    payload: {
      signedTxXdr,
      sourceAccount: unsignedPayload.payload.sourceAccount,
      amount: unsignedPayload.payload.amount,
      destination: unsignedPayload.payload.destination,
      asset: unsignedPayload.payload.asset,
      validUntilLedger: unsignedPayload.payload.validUntilLedger,
      nonce: unsignedPayload.payload.nonce,
    },
  };
}

/**
 * Sign a SAC token payment payload
 * For SAC tokens, the transaction already has auth entries prepared.
 * We need to sign the transaction itself so the facilitator can submit it.
 */
async function signSacTokenPayload(
  unsignedPayload: SacTokenPayload,
  signer: StellarSigner,
  networkConfig: (typeof STELLAR_NETWORKS)[StellarNetworkId]
): Promise<PaymentPayload> {
  let signedTxXdr: string;

  if (isKeypairSigner(signer)) {
    signedTxXdr = await signWithKeypair(
      unsignedPayload.payload.transaction,
      signer,
      networkConfig.networkPassphrase
    );
  } else if (isFreighterSigner(signer)) {
    signedTxXdr = await signWithFreighter(
      unsignedPayload.payload.transaction,
      networkConfig.networkPassphrase
    );
  } else {
    throw new Error("Unknown signer type");
  }

  const tx = Stellar.TransactionBuilder.fromXDR(signedTxXdr, networkConfig.networkPassphrase);
  const sourceAccount = tx instanceof Stellar.FeeBumpTransaction
    ? tx.innerTransaction.source
    : tx.source;

  // Return in the standard PaymentPayload format
  // For SAC tokens, we use the transaction XDR as signedTxXdr
  return {
    x402Version: unsignedPayload.x402Version,
    scheme: unsignedPayload.scheme,
    network: unsignedPayload.network as "stellar-testnet" | "stellar",
    payload: {
      signedTxXdr,
      sourceAccount,
      amount: "0", // Amount is encoded in the transaction
      destination: "", // Destination is encoded in the transaction
      asset: "", // Asset is the contract address in the operation
      validUntilLedger: 0,
      nonce: "",
    },
  };
}
