/**
 * Select Payment Requirements
 *
 * Selects the appropriate payment requirements from a list of options.
 */

import type { PaymentRequirements, StellarNetwork } from "x402-stellar";

/**
 * Selector function type for choosing payment requirements
 */
export type PaymentRequirementsSelector = (
  requirements: PaymentRequirements[],
  network?: StellarNetwork | StellarNetwork[],
  scheme?: string
) => PaymentRequirements;

/**
 * Default selector - selects the first matching Stellar payment requirements
 *
 * @param requirements - Array of payment requirements from 402 response
 * @param network - Optional network to filter by (or array of networks)
 * @param scheme - Optional scheme to filter by (default: "exact")
 * @returns The selected payment requirements
 * @throws If no matching requirements found
 *
 * @example
 * ```typescript
 * const selected = selectPaymentRequirements(
 *   accepts,
 *   "stellar-testnet",
 *   "exact"
 * );
 * ```
 */
export function selectPaymentRequirements(
  requirements: PaymentRequirements[],
  network?: StellarNetwork | StellarNetwork[],
  scheme: string = "exact"
): PaymentRequirements {
  // Filter by scheme
  let filtered = requirements.filter((r) => r.scheme === scheme);

  // Filter by network if specified
  if (network) {
    const networks = Array.isArray(network) ? network : [network];
    filtered = filtered.filter((r) =>
      networks.includes(r.network as StellarNetwork)
    );
  }

  // Also filter to only Stellar networks
  const stellarNetworks = ["stellar-testnet", "stellar"];
  filtered = filtered.filter((r) => stellarNetworks.includes(r.network));

  if (filtered.length === 0) {
    throw new Error(
      `No matching payment requirements found for scheme=${scheme}, network=${network || "any stellar"}`
    );
  }

  // Return the first match (could be extended to prefer certain networks, etc.)
  return filtered[0];
}

/**
 * Select payment requirements preferring a specific network order
 *
 * @param requirements - Array of payment requirements
 * @param preferredNetworks - Networks in order of preference
 * @param scheme - Scheme to filter by
 * @returns The selected payment requirements
 */
export function selectPaymentRequirementsWithPreference(
  requirements: PaymentRequirements[],
  preferredNetworks: StellarNetwork[] = ["stellar-testnet", "stellar"],
  scheme: string = "exact"
): PaymentRequirements {
  // Filter by scheme and stellar networks
  const stellarRequirements = requirements.filter(
    (r) =>
      r.scheme === scheme &&
      (r.network === "stellar-testnet" || r.network === "stellar")
  );

  if (stellarRequirements.length === 0) {
    throw new Error(`No Stellar payment requirements found for scheme=${scheme}`);
  }

  // Try to find a match in preference order
  for (const network of preferredNetworks) {
    const match = stellarRequirements.find((r) => r.network === network);
    if (match) {
      return match;
    }
  }

  // Return first available if no preference match
  return stellarRequirements[0];
}

