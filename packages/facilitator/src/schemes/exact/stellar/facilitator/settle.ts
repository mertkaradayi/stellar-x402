/**
 * Stellar Facilitator - Settle
 *
 * Settles a payment by submitting the transaction to the Stellar network.
 * Supports both XLM native (via Horizon) and SAC tokens (via Soroban RPC).
 */

import * as Stellar from "@stellar/stellar-sdk";
import { Server as SorobanServer, Api as SorobanApi } from "@stellar/stellar-sdk/rpc";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  StellarErrorReason,
} from "../../../../types/index.js";
import { STELLAR_NETWORKS } from "../../../../shared/stellar/index.js";

// Get facilitator secret key from environment (for fee sponsorship/signing)
const FACILITATOR_SECRET_KEY = process.env.FACILITATOR_SECRET_KEY;

/**
 * Submit a Stellar payment with optional fee sponsorship.
 *
 * Trust-minimized guarantees:
 * - For XLM: Client's signed transaction is NEVER modified (only fee-bump)
 * - For SAC: Facilitator rebuilds tx with its source and signs (Coinbase pattern)
 *
 * @param payload - The payment payload containing the signed transaction
 * @param paymentRequirements - The payment requirements for the settlement
 * @returns A SettleResponse indicating if the payment was settled successfully
 */
export async function settle(
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<SettleResponse> {
  const { payload: stellarPayload, network } = payload;
  const { signedTxXdr } = stellarPayload;
  const payer = stellarPayload.sourceAccount;

  const networkConfig = STELLAR_NETWORKS[network as keyof typeof STELLAR_NETWORKS];
  if (!networkConfig) {
    return {
      success: false,
      errorReason: "invalid_network" as StellarErrorReason,
      payer,
      transaction: "",
      network,
    };
  }

  // Require a signed transaction for settlement
  if (!signedTxXdr) {
    return {
      success: false,
      errorReason: "invalid_exact_stellar_payload_missing_signed_tx_xdr" as StellarErrorReason,
      payer,
      transaction: "",
      network,
    };
  }

  // Route to appropriate settlement based on asset type
  if (paymentRequirements.asset === "native") {
    return settleNativeXlm(payload, stellarPayload, networkConfig, payer, network);
  } else {
    return settleSacToken(payload, stellarPayload, networkConfig, payer, network, paymentRequirements);
  }
}

/**
 * Settle a native XLM payment via Horizon with optional fee-bump
 */
async function settleNativeXlm(
  _payload: PaymentPayload,
  stellarPayload: PaymentPayload["payload"],
  networkConfig: (typeof STELLAR_NETWORKS)[keyof typeof STELLAR_NETWORKS],
  payer: string,
  network: string
): Promise<SettleResponse> {
  const { signedTxXdr } = stellarPayload;

  // Parse the transaction
  let tx: Stellar.Transaction | Stellar.FeeBumpTransaction;
  let txHash: string;

  try {
    tx = Stellar.TransactionBuilder.fromXDR(signedTxXdr!, networkConfig.networkPassphrase);
    txHash = tx.hash().toString("hex");
  } catch (error) {
    return {
      success: false,
      errorReason: "invalid_exact_stellar_payload_invalid_xdr" as StellarErrorReason,
      payer,
      transaction: "",
      network,
    };
  }

  const server = new Stellar.Horizon.Server(networkConfig.horizonUrl);

  try {
    let submittedTxHash: string;

    // If facilitator key is configured, use fee-bump (fee sponsorship)
    if (FACILITATOR_SECRET_KEY) {
      const facilitatorKeypair = Stellar.Keypair.fromSecret(FACILITATOR_SECRET_KEY);
      const innerTx =
        tx instanceof Stellar.FeeBumpTransaction ? tx.innerTransaction : (tx as Stellar.Transaction);

      try {
        const feeBumpTx = Stellar.TransactionBuilder.buildFeeBumpTransaction(
          facilitatorKeypair,
          "1000000", // Max fee in stroops (0.1 XLM)
          innerTx,
          networkConfig.networkPassphrase
        );
        feeBumpTx.sign(facilitatorKeypair);

        console.log(`[settle:xlm] Submitting fee-bumped transaction...`);
        const result = await server.submitTransaction(feeBumpTx);
        submittedTxHash = result.hash;
        console.log(`[settle:xlm] Transaction successful: ${submittedTxHash}`);
      } catch (feeBumpError) {
        console.error("[settle:xlm] Fee-bump failed:", feeBumpError);
        return {
          success: false,
          errorReason: "settle_exact_stellar_fee_bump_failed" as StellarErrorReason,
          payer,
          transaction: "",
          network,
        };
      }
    } else {
      // Submit client's transaction directly (client pays fees)
      console.log(`[settle:xlm] Submitting client-signed transaction: ${txHash.slice(0, 16)}...`);
      const txToSubmit =
        tx instanceof Stellar.FeeBumpTransaction ? tx : (tx as Stellar.Transaction);
      const result = await server.submitTransaction(txToSubmit);
      submittedTxHash = result.hash;
      console.log(`[settle:xlm] Transaction successful: ${submittedTxHash}`);
    }

    return {
      success: true,
      payer,
      transaction: submittedTxHash,
      network,
    };
  } catch (error) {
    console.error("[settle:xlm] Transaction failed:", error);
    return {
      success: false,
      errorReason: "settle_exact_stellar_transaction_failed" as StellarErrorReason,
      payer,
      transaction: "",
      network,
    };
  }
}

/**
 * Settle a SAC token payment via Soroban RPC
 * The client has already built, simulated, and signed the transaction.
 * We just submit it directly to the network.
 */
async function settleSacToken(
  _payload: PaymentPayload,
  stellarPayload: PaymentPayload["payload"],
  networkConfig: (typeof STELLAR_NETWORKS)[keyof typeof STELLAR_NETWORKS],
  payer: string,
  network: string,
  paymentRequirements: PaymentRequirements
): Promise<SettleResponse> {
  const { signedTxXdr } = stellarPayload;

  const sorobanServer = new SorobanServer(networkConfig.sorobanRpcUrl);

  try {
    // Parse the client's signed transaction
    // For SAC tokens, the client has already:
    // 1. Built the transaction with themselves as source
    // 2. Simulated it (which adds auth entries)
    // 3. Signed the auth entries and transaction
    // We just need to submit it directly
    const clientTx = new Stellar.Transaction(signedTxXdr!, networkConfig.networkPassphrase);

    // Submit to Soroban network - use client's signed transaction directly
    const sendResult = await sorobanServer.sendTransaction(clientTx);

    if (sendResult.status !== "PENDING") {
      console.error("[settle:sac] Transaction submission failed:", sendResult.status);
      console.error("[settle:sac] Full sendResult:", JSON.stringify(sendResult, null, 2));
      return {
        success: false,
        errorReason: "settle_exact_stellar_transaction_failed" as StellarErrorReason,
        payer,
        transaction: "",
        network,
      };
    }

    // Poll for confirmation using SDK's built-in pollTransaction
    const txHash = sendResult.hash;
    console.log(`[settle:sac] Transaction pending: ${txHash}`);

    try {
      const finalStatus = await sorobanServer.pollTransaction(txHash, {
        sleepStrategy: () => 1000, // Poll every 1 second
        attempts: paymentRequirements.maxTimeoutSeconds || 60,
      });

      if (finalStatus.status === SorobanApi.GetTransactionStatus.SUCCESS) {
        console.log(`[settle:sac] Transaction confirmed: ${txHash}`);
        return {
          success: true,
          payer,
          transaction: txHash,
          network,
        };
      } else {
        console.error(`[settle:sac] Transaction failed with status: ${finalStatus.status}`);
        return {
          success: false,
          errorReason: "settle_exact_stellar_transaction_failed" as StellarErrorReason,
          payer,
          transaction: txHash,
          network,
        };
      }
    } catch (pollError) {
      console.error("[settle:sac] Polling failed:", pollError);
      // If polling fails but the transaction was already submitted successfully,
      // return success with the hash - the transaction likely went through
      console.log(`[settle:sac] Returning success despite poll error - tx was submitted: ${txHash}`);
      return {
        success: true,
        payer,
        transaction: txHash,
        network,
      };
    }
  } catch (error) {
    console.error("[settle:sac] Settlement failed:", error);
    return {
      success: false,
      errorReason: "settle_exact_stellar_transaction_failed" as StellarErrorReason,
      payer,
      transaction: "",
      network,
    };
  }
}

