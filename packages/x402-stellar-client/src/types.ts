/**
 * Signer types for Stellar x402 client
 */

import type { Keypair } from "@stellar/stellar-sdk";

/**
 * Keypair signer - signs using a Stellar Keypair (for backends/scripts)
 */
export interface KeypairSigner {
  type: "keypair";
  keypair: Keypair;
}

/**
 * Freighter signer - signs using the Freighter browser wallet
 */
export interface FreighterSigner {
  type: "freighter";
}

/**
 * Union of all supported signer types
 */
export type StellarSigner = KeypairSigner | FreighterSigner;

/**
 * Create a keypair signer
 */
export function createKeypairSigner(keypair: Keypair): KeypairSigner {
  return { type: "keypair", keypair };
}

/**
 * Create a Freighter signer
 */
export function createFreighterSigner(): FreighterSigner {
  return { type: "freighter" };
}

/**
 * Type guard to check if a signer is a keypair signer
 */
export function isKeypairSigner(signer: StellarSigner): signer is KeypairSigner {
  return signer.type === "keypair";
}

/**
 * Type guard to check if a signer is a Freighter signer
 */
export function isFreighterSigner(signer: StellarSigner): signer is FreighterSigner {
  return signer.type === "freighter";
}

