/**
 * Keypair Signer
 *
 * Signs Stellar transactions using a Stellar.Keypair (for backends/scripts)
 */

import * as Stellar from "@stellar/stellar-sdk";
import type { KeypairSigner } from "../types.js";

/**
 * Sign a transaction XDR using a Keypair
 *
 * @param unsignedTxXdr - The unsigned transaction XDR (base64)
 * @param signer - The keypair signer
 * @param networkPassphrase - The network passphrase
 * @returns The signed transaction XDR (base64)
 */
export async function signWithKeypair(
  unsignedTxXdr: string,
  signer: KeypairSigner,
  networkPassphrase: string
): Promise<string> {
  // Parse the unsigned transaction
  const tx = Stellar.TransactionBuilder.fromXDR(unsignedTxXdr, networkPassphrase);

  // Sign the transaction
  if (tx instanceof Stellar.FeeBumpTransaction) {
    throw new Error("Cannot sign fee-bump transactions with client signer");
  }

  tx.sign(signer.keypair);

  // Return the signed XDR
  return tx.toXDR();
}

/**
 * Get the public key from a Keypair signer
 */
export function getPublicKeyFromKeypair(signer: KeypairSigner): string {
  return signer.keypair.publicKey();
}

