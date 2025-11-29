/**
 * Facilitator Types and Error Codes
 */

// Re-export types from x402Specs for convenience
export type {
  PaymentRequirements,
  StellarPayload,
  PaymentPayload,
  VerifyResponse,
  SettleResponse,
  SupportedPaymentKind,
  SupportedPaymentKindsResponse,
  x402Response,
  DiscoveredResource,
  ListDiscoveryResourcesRequest,
  DiscoveryPagination,
  ListDiscoveryResourcesResponse,
} from "./x402Specs.js";

// ============================================================================
// Error Codes (matching Coinbase x402 spec pattern)
// ============================================================================

export const StellarErrorReasons = [
  // Generic x402 errors (from Coinbase spec)
  "insufficient_funds",
  "invalid_network",
  "invalid_payload",
  "invalid_payment_requirements",
  "invalid_scheme",
  "invalid_payment",
  "payment_expired",
  "unsupported_scheme",
  "invalid_x402_version",
  "invalid_transaction_state",
  "unexpected_settle_error",
  "unexpected_verify_error",
  // Stellar-specific errors (following Coinbase naming pattern: invalid_exact_{network}_payload_*)
  "invalid_exact_stellar_payload_missing_signed_tx_xdr",
  "invalid_exact_stellar_payload_invalid_xdr",
  "invalid_exact_stellar_payload_source_account_not_found",
  "invalid_exact_stellar_payload_insufficient_balance",
  "invalid_exact_stellar_payload_amount_mismatch",
  "invalid_exact_stellar_payload_destination_mismatch",
  "invalid_exact_stellar_payload_asset_mismatch",
  "invalid_exact_stellar_payload_network_mismatch",
  "invalid_exact_stellar_payload_missing_required_fields",
  "invalid_exact_stellar_payload_transaction_expired",
  "invalid_exact_stellar_payload_transaction_already_used",
  "settle_exact_stellar_transaction_failed",
  "settle_exact_stellar_fee_bump_failed",
] as const;

export type StellarErrorReason = (typeof StellarErrorReasons)[number];

// ============================================================================
// Facilitator Config
// ============================================================================

export interface FacilitatorConfig {
  url: string;
  createAuthHeaders?: () => Promise<{
    verify: Record<string, string>;
    settle: Record<string, string>;
    supported: Record<string, string>;
    list?: Record<string, string>;
  }>;
}

// ============================================================================
// Supported (scheme, network) combinations
// ============================================================================

export const SUPPORTED_NETWORKS = ["stellar-testnet", "stellar"] as const;
export type SupportedNetwork = (typeof SUPPORTED_NETWORKS)[number];
