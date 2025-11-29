/**
 * Prepare Payment Header
 *
 * Builds an unsigned payment payload (transaction) for the x402 protocol.
 */

import * as Stellar from "@stellar/stellar-sdk";
import {
  type PaymentRequirements,
  type StellarPayload,
  STELLAR_NETWORKS,
  type StellarNetworkId,
} from "x402-stellar";

/**
 * Unsigned payment payload - same as PaymentPayload but with optional signedTxXdr
 */
export interface UnsignedPaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  payload: Omit<StellarPayload, "signedTxXdr"> & { unsignedTxXdr: string };
}

/**
 * Options for preparing a payment header
 */
export interface PreparePaymentOptions {
  /** Source account public key */
  sourceAccount: string;
  /** Payment requirements from the 402 response */
  paymentRequirements: PaymentRequirements;
  /** Optional custom timeout in seconds (default: from paymentRequirements) */
  timeoutSeconds?: number;
}

/**
 * Prepare an unsigned payment payload for the x402 protocol
 *
 * This function:
 * 1. Builds a Stellar transaction with the payment operation
 * 2. Returns an unsigned payload ready for signing
 *
 * @param options - The options for preparing the payment
 * @returns An unsigned payment payload
 *
 * @example
 * ```typescript
 * const unsignedPayload = await preparePaymentHeader({
 *   sourceAccount: "GXXXX...",
 *   paymentRequirements: requirements,
 * });
 * ```
 */
export async function preparePaymentHeader(
  options: PreparePaymentOptions
): Promise<UnsignedPaymentPayload> {
  const { sourceAccount, paymentRequirements, timeoutSeconds } = options;

  const network = paymentRequirements.network as StellarNetworkId;
  const networkConfig = STELLAR_NETWORKS[network];

  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Connect to Horizon
  const server = new Stellar.Horizon.Server(networkConfig.horizonUrl);

  // Load the source account
  const account = await server.loadAccount(sourceAccount);

  // Generate a unique nonce
  const nonce = crypto.randomUUID();

  // Calculate timeout
  const timeout = timeoutSeconds || paymentRequirements.maxTimeoutSeconds || 300;

  // Build the transaction
  const txBuilder = new Stellar.TransactionBuilder(account, {
    fee: "100", // Base fee in stroops (will be replaced by fee-bump if facilitator sponsors)
    networkPassphrase: networkConfig.networkPassphrase,
  });

  // Add the payment operation
  if (paymentRequirements.asset === "native") {
    // Native XLM payment
    txBuilder.addOperation(
      Stellar.Operation.payment({
        destination: paymentRequirements.payTo,
        asset: Stellar.Asset.native(),
        // Amount in XLM (Stellar uses 7 decimals, convert from stroops)
        amount: (BigInt(paymentRequirements.maxAmountRequired) / BigInt(10_000_000)).toString() +
          "." +
          (BigInt(paymentRequirements.maxAmountRequired) % BigInt(10_000_000)).toString().padStart(7, "0"),
      })
    );
  } else {
    // Soroban token payment (SAC - Stellar Asset Contract)
    // For now, we only support native XLM
    throw new Error("Soroban token payments not yet implemented");
  }

  // Set timeout
  txBuilder.setTimeout(timeout);

  // Build the transaction (unsigned)
  const tx = txBuilder.build();

  // Get the valid until ledger (approximate)
  const ledgerResponse = await server.ledgers().order("desc").limit(1).call();
  const currentLedger = ledgerResponse.records[0].sequence;
  // Stellar averages ~5 seconds per ledger
  const validUntilLedger = currentLedger + Math.ceil(timeout / 5);

  return {
    x402Version: 1,
    scheme: "exact",
    network,
    payload: {
      unsignedTxXdr: tx.toXDR(),
      sourceAccount,
      amount: paymentRequirements.maxAmountRequired,
      destination: paymentRequirements.payTo,
      asset: paymentRequirements.asset,
      validUntilLedger,
      nonce,
    },
  };
}

