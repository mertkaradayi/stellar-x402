/**
 * Zod Schemas for x402 Protocol - Stellar Implementation
 *
 * Following Coinbase x402 pattern: types/verify/x402Specs.ts
 * These schemas match Coinbase's x402 specification exactly,
 * with Stellar-specific types for the payload.
 */

import { z } from "zod";

// ============================================================================
// Constants (matching Coinbase x402 spec)
// ============================================================================

export const schemes = ["exact"] as const;
export const x402Versions = [1] as const;
export const stellarNetworks = ["stellar-testnet", "stellar"] as const;

// ============================================================================
// Regex Patterns
// ============================================================================

// Stellar public key: G followed by 55 base32 characters
const StellarAddressRegex = /^G[A-Z2-7]{55}$/;

// Stellar contract address: C followed by 55 base32 characters
const StellarContractRegex = /^C[A-Z2-7]{55}$/;

// Asset can be "native" or a contract address
const StellarAssetRegex = /^(native|C[A-Z2-7]{55})$/;

// Base64 encoded string (for XDR)
const Base64EncodedRegex = /^[A-Za-z0-9+/]*={0,2}$/;

// ============================================================================
// Refiners (matching Coinbase pattern)
// ============================================================================

const isNonNegativeIntegerString = (value: string): boolean =>
  /^\d+$/.test(value) && Number.isInteger(Number(value)) && Number(value) >= 0;

// ============================================================================
// Network Schema
// ============================================================================

export const StellarNetworkSchema = z.enum(stellarNetworks);
export type StellarNetwork = z.infer<typeof StellarNetworkSchema>;

// ============================================================================
// PaymentRequirements Schema (per x402 spec section 5.1.2)
// ============================================================================

export const PaymentRequirementsSchema = z.object({
  scheme: z.enum(schemes),
  network: StellarNetworkSchema,
  maxAmountRequired: z.string().refine(isNonNegativeIntegerString, {
    message: "maxAmountRequired must be a non-negative integer string",
  }),
  resource: z.string().url({ message: "resource must be a valid URL" }),
  description: z.string(),
  mimeType: z.string(),
  outputSchema: z.record(z.any()).optional().nullable(),
  payTo: z.string().regex(StellarAddressRegex, {
    message: "payTo must be a valid Stellar address (G...)",
  }),
  maxTimeoutSeconds: z.number().int().positive(),
  asset: z.string().regex(StellarAssetRegex, {
    message: 'asset must be "native" or a valid Stellar contract address (C...)',
  }),
  extra: z.record(z.any()).optional().nullable(),
});

// ============================================================================
// Stellar Payload Schema (Stellar-specific, analogous to ExactEvmPayload)
// ============================================================================

export const StellarPayloadSchema = z.object({
  // The signed transaction envelope (XDR format, base64 encoded)
  signedTxXdr: z.string().regex(Base64EncodedRegex, {
    message: "signedTxXdr must be valid base64",
  }),
  // Source account (payer's public key)
  sourceAccount: z.string().regex(StellarAddressRegex, {
    message: "sourceAccount must be a valid Stellar address (G...)",
  }),
  // Amount in stroops (7 decimals: 1 unit = 10^7 stroops)
  amount: z.string().refine(isNonNegativeIntegerString, {
    message: "amount must be a non-negative integer string (stroops)",
  }),
  // Destination account (payTo address)
  destination: z.string().regex(StellarAddressRegex, {
    message: "destination must be a valid Stellar address (G...)",
  }),
  // Asset: "native" for XLM or contract address for Soroban tokens
  asset: z.string().regex(StellarAssetRegex, {
    message: 'asset must be "native" or a valid Stellar contract address (C...)',
  }),
  // Expiration: ledger number after which the tx is invalid
  validUntilLedger: z.number().int().positive(),
  // Unique nonce for replay protection
  nonce: z.string().min(1, { message: "nonce is required" }),
});

// ============================================================================
// PaymentPayload Schema (per x402 spec section 5.2)
// ============================================================================

export const PaymentPayloadSchema = z.object({
  x402Version: z.number().refine((val) => x402Versions.includes(val as 1), {
    message: "x402Version must be 1",
  }),
  scheme: z.enum(schemes),
  network: StellarNetworkSchema,
  payload: StellarPayloadSchema,
});

// ============================================================================
// Facilitator Request Schemas (per x402 spec section 7)
// ============================================================================

// Supports both paymentHeader (base64) and paymentPayload (JSON object)
export const FacilitatorRequestSchema = z
  .object({
    x402Version: z.number().refine((val) => x402Versions.includes(val as 1), {
      message: "x402Version must be 1",
    }),
    paymentHeader: z.string().optional(),
    paymentPayload: PaymentPayloadSchema.optional(),
    paymentRequirements: PaymentRequirementsSchema,
  })
  .refine((data) => data.paymentHeader || data.paymentPayload, {
    message: "Either paymentHeader or paymentPayload is required",
  });

// Alias for clarity
export const VerifyRequestSchema = FacilitatorRequestSchema;
export const SettleRequestSchema = FacilitatorRequestSchema;

// ============================================================================
// Response Schemas (per x402 spec sections 7.1 and 7.2)
// ============================================================================

export const VerifyResponseSchema = z.object({
  isValid: z.boolean(),
  invalidReason: z.string().optional(),
  payer: z.string().optional(),
});

export const SettleResponseSchema = z.object({
  success: z.boolean(),
  errorReason: z.string().optional(),
  payer: z.string().optional(),
  transaction: z.string(),
  network: z.string(),
});

// ============================================================================
// Supported Payment Kind Schema (per x402 spec section 7.3)
// ============================================================================

export const SupportedPaymentKindSchema = z.object({
  x402Version: z.number().refine((val) => x402Versions.includes(val as 1), {
    message: "x402Version must be 1",
  }),
  scheme: z.enum(schemes),
  network: StellarNetworkSchema,
  extra: z.record(z.any()).optional(),
});

export const SupportedPaymentKindsResponseSchema = z.object({
  kinds: z.array(SupportedPaymentKindSchema),
});

// ============================================================================
// 402 Response Schema (for HTTP 402 responses)
// ============================================================================

export const x402ResponseSchema = z.object({
  x402Version: z.number().refine((val) => x402Versions.includes(val as 1)),
  error: z.string().optional(),
  accepts: z.array(PaymentRequirementsSchema).optional(),
  payer: z.string().optional(),
});

// Export unused regex for potential external use
export { StellarAddressRegex, StellarContractRegex, StellarAssetRegex, Base64EncodedRegex };

