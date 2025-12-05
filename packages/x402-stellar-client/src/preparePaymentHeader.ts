/**
 * Prepare Payment Header
 *
 * Builds an unsigned payment payload (transaction) for the x402 protocol.
 * Supports both XLM native payments and SAC token payments (e.g., USDC).
 */

import * as Stellar from "@stellar/stellar-sdk";
import { nativeToScVal } from "@stellar/stellar-sdk";
import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import {
  type PaymentRequirements,
  type StellarPayload,
  STELLAR_NETWORKS,
  type StellarNetworkId,
} from "x402-stellar";

/**
 * Check if an asset is native XLM
 */
function isNativeAsset(asset: string): boolean {
  return asset === "native";
}

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
 * SAC Token payload (Coinbase x402 compatible)
 * Uses invokeHostFunction for SEP-41 transfer
 */
export interface SacTokenPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  payload: {
    /** Base64 XDR of the transaction (unsigned, needs auth entry signing) */
    transaction: string;
  };
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
 * 1. Determines asset type (native XLM or SAC token)
 * 2. Builds appropriate transaction (Horizon payment or Soroban invokeHostFunction)
 * 3. Returns an unsigned payload ready for signing
 *
 * @param options - The options for preparing the payment
 * @returns An unsigned payment payload (XLM) or SAC token payload (USDC, etc.)
 *
 * @example
 * ```typescript
 * // XLM payment
 * const payload = await preparePaymentHeader({
 *   sourceAccount: "GXXXX...",
 *   paymentRequirements: { asset: "native", ... },
 * });
 *
 * // USDC payment
 * const payload = await preparePaymentHeader({
 *   sourceAccount: "GXXXX...",
 *   paymentRequirements: { asset: "CBIELTK6...", ... },
 * });
 * ```
 */
export async function preparePaymentHeader(
  options: PreparePaymentOptions
): Promise<UnsignedPaymentPayload | SacTokenPayload> {
  const { paymentRequirements } = options;

  const network = paymentRequirements.network as StellarNetworkId;
  const networkConfig = STELLAR_NETWORKS[network];

  if (!networkConfig) {
    throw new Error(`Unsupported network: ${network}`);
  }

  // Route to appropriate handler based on asset type
  if (isNativeAsset(paymentRequirements.asset)) {
    return prepareNativeXlmPayment(options, networkConfig);
  } else {
    return prepareSacTokenPayment(options, networkConfig);
  }
}

/**
 * Prepare a native XLM payment using Horizon payment operation
 */
async function prepareNativeXlmPayment(
  options: PreparePaymentOptions,
  networkConfig: (typeof STELLAR_NETWORKS)[StellarNetworkId]
): Promise<UnsignedPaymentPayload> {
  const { sourceAccount, paymentRequirements, timeoutSeconds } = options;
  const network = paymentRequirements.network as StellarNetworkId;

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

  // Native XLM payment
  txBuilder.addOperation(
    Stellar.Operation.payment({
      destination: paymentRequirements.payTo,
      asset: Stellar.Asset.native(),
      // Amount in XLM (Stellar uses 7 decimals, convert from stroops)
      amount:
        (BigInt(paymentRequirements.maxAmountRequired) / BigInt(10_000_000)).toString() +
        "." +
        (BigInt(paymentRequirements.maxAmountRequired) % BigInt(10_000_000)).toString().padStart(7, "0"),
    })
  );

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

/**
 * Prepare a SAC token payment using Soroban invokeHostFunction
 * This is compatible with Coinbase x402 Stellar implementation
 */
async function prepareSacTokenPayment(
  options: PreparePaymentOptions,
  networkConfig: (typeof STELLAR_NETWORKS)[StellarNetworkId]
): Promise<SacTokenPayload> {
  const { sourceAccount, paymentRequirements } = options;
  const network = paymentRequirements.network as StellarNetworkId;

  // Build SAC token transfer using AssembledTransaction
  // SEP-41 interface: transfer(from, to, amount)
  const tx = await AssembledTransaction.build({
    contractId: paymentRequirements.asset,
    method: "transfer",
    args: [
      // SEP-41 spec: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md
      nativeToScVal(sourceAccount, { type: "address" }), // from
      nativeToScVal(paymentRequirements.payTo, { type: "address" }), // to
      nativeToScVal(paymentRequirements.maxAmountRequired, { type: "i128" }), // amount
    ],
    networkPassphrase: networkConfig.networkPassphrase,
    rpcUrl: networkConfig.sorobanRpcUrl,
    publicKey: sourceAccount,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parseResultXdr: (result: any) => result,
  });

  // Validate simulation succeeded
  if (!tx.built) {
    throw new Error("Failed to build SAC token transfer transaction");
  }

  return {
    x402Version: 1,
    scheme: "exact",
    network,
    payload: {
      transaction: tx.built.toXDR(),
    },
  };
}
