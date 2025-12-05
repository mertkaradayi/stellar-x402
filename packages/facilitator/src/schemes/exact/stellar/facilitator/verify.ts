/**
 * Stellar Facilitator - Verify
 *
 * Verifies a payment payload against the payment requirements.
 * Following Coinbase x402 naming convention: verify() instead of verifyStellarPayment()
 */

import * as Stellar from "@stellar/stellar-sdk";
import { Server as SorobanServer, Api as SorobanApi } from "@stellar/stellar-sdk/rpc";
import type {
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  StellarErrorReason,
} from "../../../../types/index.js";
import { STELLAR_NETWORKS } from "../../../../shared/stellar/index.js";
import { SCHEME } from "../../index.js";

/**
 * Verify a payment payload against the payment requirements.
 *
 * @param payload - The payment payload to verify
 * @param paymentRequirements - The payment requirements to verify against
 * @returns A VerifyResponse indicating if the payment is valid and any invalidation reason
 */
export async function verify(
  payload: PaymentPayload,
  paymentRequirements: PaymentRequirements
): Promise<VerifyResponse> {
  const { payload: stellarPayload, network } = payload;
  const payer = stellarPayload?.sourceAccount;

  // Verify scheme
  if (payload.scheme !== SCHEME || paymentRequirements.scheme !== SCHEME) {
    return {
      isValid: false,
      invalidReason: "unsupported_scheme" as StellarErrorReason,
      payer,
    };
  }

  // Validate network
  if (network !== paymentRequirements.network) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_stellar_payload_network_mismatch" as StellarErrorReason,
      payer,
    };
  }

  // Validate payload structure
  if (!stellarPayload || typeof stellarPayload !== "object") {
    return {
      isValid: false,
      invalidReason: "invalid_payload" as StellarErrorReason,
    };
  }

  const { sourceAccount, amount, destination, asset, signedTxXdr } = stellarPayload;

  // Check required fields
  if (!sourceAccount || !amount || !destination) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_stellar_payload_missing_required_fields" as StellarErrorReason,
      payer,
    };
  }

  // Validate destination matches payTo
  if (destination !== paymentRequirements.payTo) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_stellar_payload_destination_mismatch" as StellarErrorReason,
      payer,
    };
  }

  // Validate amount is sufficient
  const payloadAmount = BigInt(amount);
  const requiredAmount = BigInt(paymentRequirements.maxAmountRequired);
  if (payloadAmount < requiredAmount) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_stellar_payload_amount_mismatch" as StellarErrorReason,
      payer,
    };
  }

  // Validate asset matches (if specified in requirements)
  if (paymentRequirements.asset && asset !== paymentRequirements.asset) {
    return {
      isValid: false,
      invalidReason: "invalid_exact_stellar_payload_asset_mismatch" as StellarErrorReason,
      payer,
    };
  }

  // Check if the source account exists and has sufficient balance
  const networkConfig = STELLAR_NETWORKS[network as keyof typeof STELLAR_NETWORKS];
  if (!networkConfig) {
    return {
      isValid: false,
      invalidReason: "invalid_network" as StellarErrorReason,
      payer,
    };
  }

  try {
    const server = new Stellar.Horizon.Server(networkConfig.horizonUrl);
    const account = await server.loadAccount(sourceAccount);

    // For native XLM payments, check XLM balance
    if (asset === "native") {
      const xlmBalance = account.balances.find((b) => b.asset_type === "native");
      if (xlmBalance) {
        // Convert to stroops (all Stellar assets use 7 decimals: 1 unit = 10^7 stroops)
        const balanceStroops = BigInt(Math.floor(parseFloat(xlmBalance.balance) * 10_000_000));
        if (balanceStroops < payloadAmount) {
          return {
            isValid: false,
            invalidReason: "insufficient_funds" as StellarErrorReason,
            payer,
          };
        }
      }
    } else {
      // For SAC token payments, verify via Soroban RPC simulation
      // This matches Coinbase x402 pattern of simulating the transaction
      try {
        const sorobanServer = new SorobanServer(networkConfig.sorobanRpcUrl);

        // If we have a transaction XDR, simulate it to verify it will succeed
        if (signedTxXdr) {
          const tx = Stellar.TransactionBuilder.fromXDR(signedTxXdr, networkConfig.networkPassphrase);
          const simulation = await sorobanServer.simulateTransaction(tx);

          if (SorobanApi.isSimulationError(simulation)) {
            console.log("[verify] SAC token simulation failed:", simulation.error);
            return {
              isValid: false,
              invalidReason: "invalid_exact_stellar_payload_simulation_failed" as StellarErrorReason,
              payer,
            };
          }
          console.log("[verify] SAC token simulation succeeded");
        }
      } catch (sorobanError) {
        console.error("[verify] Soroban RPC error:", sorobanError);
        // Fall through - we'll still accept if no simulation is available
      }
    }


    // If we have a signed transaction, try to parse it
    if (signedTxXdr) {
      try {
        const tx = Stellar.TransactionBuilder.fromXDR(signedTxXdr, networkConfig.networkPassphrase);
        console.log("[verify] Parsed transaction:", tx.hash().toString("hex"));
      } catch (parseError) {
        return {
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_invalid_xdr" as StellarErrorReason,
          payer,
        };
      }
    }

    console.log("[verify] Payment verified successfully");
    return {
      isValid: true,
      payer,
    };
  } catch (error) {
    // Account not found or other error
    if (error instanceof Error && error.message.includes("Not Found")) {
      return {
        isValid: false,
        invalidReason: "invalid_exact_stellar_payload_source_account_not_found" as StellarErrorReason,
        payer,
      };
    }
    return {
      isValid: false,
      invalidReason: "unexpected_verify_error" as StellarErrorReason,
      payer,
    };
  }
}

/**
 * Extract the transaction hash from a signed XDR without full validation.
 * Useful for replay protection checks.
 *
 * @param signedTxXdr - The signed transaction XDR
 * @param networkPassphrase - The network passphrase
 * @returns The transaction hash or null if parsing fails
 */
export function getTxHashFromXdr(signedTxXdr: string, networkPassphrase: string): string | null {
  try {
    const tx = Stellar.TransactionBuilder.fromXDR(signedTxXdr, networkPassphrase);
    return tx.hash().toString("hex");
  } catch {
    return null;
  }
}

