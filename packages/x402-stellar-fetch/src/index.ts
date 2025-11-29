/**
 * x402-stellar-fetch - Fetch wrapper that automatically handles x402 payments
 *
 * Wraps the native fetch API to automatically handle 402 Payment Required responses
 * by creating and sending a Stellar payment header.
 */

import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  decodePaymentHeader,
} from "x402-stellar";
import {
  createPaymentHeader,
  selectPaymentRequirements,
  type StellarSigner,
  type PaymentRequirementsSelector,
} from "x402-stellar-client";

/**
 * Options for wrapFetchWithPayment
 */
export interface WrapFetchOptions {
  /** Maximum payment amount in stroops (default: 10_000_000 = 1 XLM) */
  maxAmount?: bigint;
  /** Custom requirement selector function */
  requirementSelector?: PaymentRequirementsSelector;
}

/**
 * Decoded X-PAYMENT-RESPONSE header
 */
export interface PaymentResponse {
  success: boolean;
  transaction: string;
  network: string;
  payer: string;
}

/**
 * Wraps the native fetch API to automatically handle 402 Payment Required responses.
 *
 * When a 402 response is received:
 * 1. Parses the payment requirements from the response
 * 2. Selects a Stellar-compatible payment option
 * 3. Verifies the amount is within the allowed maximum
 * 4. Creates and signs a payment header using the provided signer
 * 5. Retries the request with the X-PAYMENT header
 *
 * @param fetch - The fetch function to wrap (typically globalThis.fetch)
 * @param signer - The signer used to sign payment transactions
 * @param options - Optional configuration
 * @returns A wrapped fetch function that handles 402 responses automatically
 *
 * @example
 * ```typescript
 * import { wrapFetchWithPayment } from "x402-stellar-fetch";
 * import { createKeypairSigner } from "x402-stellar-client";
 * import { Keypair } from "@stellar/stellar-sdk";
 *
 * const keypair = Keypair.fromSecret("SXXX...");
 * const signer = createKeypairSigner(keypair);
 *
 * const fetchWithPay = wrapFetchWithPayment(fetch, signer, {
 *   maxAmount: BigInt(10_000_000), // 1 XLM max
 * });
 *
 * // Make a request that may require payment
 * const response = await fetchWithPay("https://api.example.com/premium");
 * ```
 */
export function wrapFetchWithPayment(
  fetch: typeof globalThis.fetch,
  signer: StellarSigner,
  options: WrapFetchOptions = {}
) {
  const { maxAmount = BigInt(10_000_000), requirementSelector = selectPaymentRequirements } =
    options;

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Make the initial request
    const response = await fetch(input, init);

    // If not a 402, return as-is
    if (response.status !== 402) {
      return response;
    }

    // Parse the 402 response
    let x402Response: { x402Version: number; accepts: unknown[] };
    try {
      x402Response = (await response.json()) as { x402Version: number; accepts: unknown[] };
    } catch {
      throw new Error("Failed to parse 402 response body");
    }

    if (!x402Response.accepts || !Array.isArray(x402Response.accepts)) {
      throw new Error("402 response missing 'accepts' array");
    }

    // Parse and validate payment requirements
    const parsedRequirements = x402Response.accepts.map((req) =>
      PaymentRequirementsSchema.parse(req)
    );

    // Select a Stellar-compatible requirement
    let selectedRequirement: PaymentRequirements;
    try {
      selectedRequirement = requirementSelector(parsedRequirements);
    } catch {
      throw new Error("No Stellar payment requirements found in 402 response");
    }

    // Check amount against maximum
    const requiredAmount = BigInt(selectedRequirement.maxAmountRequired);
    if (requiredAmount > maxAmount) {
      throw new Error(
        `Payment amount ${requiredAmount} exceeds maximum allowed ${maxAmount}`
      );
    }

    // Prevent infinite retry loops
    const retryHeader = init?.headers
      ? new Headers(init.headers).get("X-402-RETRY")
      : null;
    if (retryHeader === "true") {
      throw new Error("Payment already attempted - possible infinite loop");
    }

    // Create the payment header
    const paymentHeader = await createPaymentHeader({
      signer,
      x402Version: x402Response.x402Version,
      paymentRequirements: selectedRequirement,
    });

    // Retry the request with the payment header
    const existingHeaders: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          existingHeaders[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        init.headers.forEach(([key, value]) => {
          existingHeaders[key] = value;
        });
      } else {
        Object.assign(existingHeaders, init.headers);
      }
    }

    const retryInit: RequestInit = {
      ...init,
      headers: {
        ...existingHeaders,
        "X-PAYMENT": paymentHeader,
        "X-402-RETRY": "true",
      },
    };

    return fetch(input, retryInit);
  };
}

/**
 * Decode the X-PAYMENT-RESPONSE header from a successful payment response
 *
 * @param response - The response from a paid request
 * @returns The decoded payment response, or null if header is missing
 *
 * @example
 * ```typescript
 * const response = await fetchWithPay("https://api.example.com/premium");
 * const paymentInfo = decodePaymentResponse(response);
 * if (paymentInfo) {
 *   console.log(`Paid with tx: ${paymentInfo.transaction}`);
 * }
 * ```
 */
export function decodePaymentResponse(response: Response): PaymentResponse | null {
  const header = response.headers.get("X-PAYMENT-RESPONSE");
  if (!header) {
    return null;
  }

  try {
    return decodePaymentHeader<PaymentResponse>(header);
  } catch {
    return null;
  }
}

// Re-export useful types
export type { StellarSigner, PaymentRequirementsSelector } from "x402-stellar-client";
export { createKeypairSigner, createFreighterSigner } from "x402-stellar-client";

