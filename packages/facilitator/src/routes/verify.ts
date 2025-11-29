/**
 * Verify Route Handler
 *
 * HTTP route handler for the /verify endpoint.
 * Following Coinbase x402 pattern: routes stay thin, calling scheme functions.
 */

import type { Request, Response } from "express";
import type { VerifyResponse, StellarErrorReason } from "../types/index.js";
import { extractPaymentPayload } from "../types/index.js";
import { VerifyRequestSchema } from "../types/verify/x402Specs.js";
import { verify, getTxHashFromXdr } from "../schemes/exact/stellar/facilitator/index.js";
import { STELLAR_NETWORKS } from "../shared/stellar/index.js";
import { hasTransactionBeenUsed } from "../storage/replay-store.js";

export async function verifyRoute(req: Request, res: Response): Promise<void> {
  // Step 1: Validate request with Zod schema
  const parseResult = VerifyRequestSchema.safeParse(req.body);

  if (!parseResult.success) {
    // Extract the first error for a more specific message
    const firstError = parseResult.error.errors[0];
    const errorPath = firstError?.path?.join(".") || "";
    const errorMessage = firstError?.message || "Invalid request";

    console.log("[/verify] Zod validation failed:", parseResult.error.errors);

    // Map Zod errors to x402 error codes
    let invalidReason: StellarErrorReason = "invalid_payload";
    if (errorPath.includes("x402Version")) {
      invalidReason = "invalid_x402_version";
    } else if (errorPath.includes("paymentRequirements")) {
      invalidReason = "invalid_payment_requirements";
    } else if (errorPath.includes("network")) {
      invalidReason = "invalid_network";
    } else if (errorPath.includes("scheme")) {
      invalidReason = "invalid_scheme";
    }

    res.json({
      isValid: false,
      invalidReason,
    } satisfies VerifyResponse);
    return;
  }

  const { x402Version, paymentHeader, paymentPayload: payloadObj, paymentRequirements } = parseResult.data;

  console.log("[/verify] Received request:", {
    x402Version,
    paymentHeader: paymentHeader ? paymentHeader.slice(0, 100) + "..." : undefined,
    paymentPayload: payloadObj ? "provided" : undefined,
    paymentRequirements: paymentRequirements ? JSON.stringify(paymentRequirements).slice(0, 200) : undefined,
  });

  // Step 2: Extract and validate the payment payload from either format
  // Note: Zod already validated paymentPayload if provided, but we need to handle paymentHeader (base64)
  const validation = extractPaymentPayload(paymentHeader, payloadObj);
  if (!validation.valid) {
    console.log("[/verify] Payload extraction failed:", validation.error);
    res.json({
      isValid: false,
      invalidReason: "invalid_payload" as StellarErrorReason,
    } satisfies VerifyResponse);
    return;
  }

  const paymentPayload = validation.payload;
  console.log("[/verify] Decoded payload:", {
    x402Version: paymentPayload.x402Version,
    scheme: paymentPayload.scheme,
    network: paymentPayload.network,
  });

  // Step 3: Replay protection - Check if this transaction has already been used
  const signedTxXdr = paymentPayload.payload?.signedTxXdr;
  const payer = paymentPayload.payload?.sourceAccount;

  if (signedTxXdr) {
    const networkConfig = STELLAR_NETWORKS[paymentPayload.network as keyof typeof STELLAR_NETWORKS];
    if (networkConfig) {
      const txHash = getTxHashFromXdr(signedTxXdr, networkConfig.networkPassphrase);
      if (txHash && (await hasTransactionBeenUsed(txHash))) {
        console.log(`[/verify] Transaction ${txHash.slice(0, 16)}... already used`);
        res.json({
          isValid: false,
          invalidReason: "invalid_exact_stellar_payload_transaction_already_used" as StellarErrorReason,
          payer,
        } satisfies VerifyResponse);
        return;
      }
    }
  }

  // Step 4: Perform Stellar-specific verification using scheme function
  try {
    const response = await verify(paymentPayload, paymentRequirements);
    console.log("[/verify] Response:", response);
    res.json(response);
  } catch (error) {
    console.error("[/verify] Error:", error);
    res.json({
      isValid: false,
      invalidReason: "unexpected_verify_error" as StellarErrorReason,
      payer,
    } satisfies VerifyResponse);
  }
}
