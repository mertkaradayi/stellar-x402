/**
 * Sign Payment Header
 *
 * Signs an unsigned payment payload using the provided signer.
 */

import { STELLAR_NETWORKS, type StellarNetworkId, type PaymentPayload } from "x402-stellar";
import type { StellarSigner } from "./types.js";
import type { UnsignedPaymentPayload } from "./preparePaymentHeader.js";
import { isKeypairSigner, isFreighterSigner } from "./types.js";
import { signWithKeypair } from "./signers/keypair.js";
import { signWithFreighter } from "./signers/freighter.js";

/**
 * Sign an unsigned payment payload
 *
 * @param unsignedPayload - The unsigned payment payload
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
  unsignedPayload: UnsignedPaymentPayload,
  signer: StellarSigner
): Promise<PaymentPayload> {
  const network = unsignedPayload.network as StellarNetworkId;
  const networkConfig = STELLAR_NETWORKS[network];

  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network}`);
  }

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

