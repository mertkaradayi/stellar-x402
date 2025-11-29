/**
 * Paywall Utilities
 *
 * Helper functions for the Stellar paywall UI.
 */

import type { PaymentRequirements } from "x402-stellar";

/**
 * Check if a network is a Stellar network
 */
export function isStellarNetwork(network: string): boolean {
  return network === "stellar-testnet" || network === "stellar";
}

/**
 * Check if a network is a testnet
 */
export function isTestnetNetwork(network: string): boolean {
  return network === "stellar-testnet";
}

/**
 * Get display name for a network
 */
export function getNetworkDisplayName(network: string): string {
  switch (network) {
    case "stellar-testnet":
      return "Stellar Testnet";
    case "stellar":
      return "Stellar Mainnet";
    default:
      return network;
  }
}

/**
 * Format stroops to XLM with proper decimals
 * Stellar uses 7 decimal places (1 XLM = 10^7 stroops)
 */
export function formatStroopsToXLM(stroops: string | bigint): string {
  const stroopsNum = typeof stroops === "string" ? BigInt(stroops) : stroops;
  const xlm = Number(stroopsNum) / 10_000_000;
  return xlm.toFixed(7).replace(/\.?0+$/, ""); // Remove trailing zeros
}

/**
 * Format stroops to a user-friendly display string
 */
export function formatAmount(stroops: string, asset: string): string {
  const xlm = formatStroopsToXLM(stroops);
  if (asset === "native") {
    return `${xlm} XLM`;
  }
  // For custom tokens, just show the amount and truncated address
  const shortAddress = asset.slice(0, 8) + "..." + asset.slice(-4);
  return `${xlm} ${shortAddress}`;
}

/**
 * Choose the best payment requirement for Stellar
 */
export function chooseStellarPaymentRequirement(
  requirements: PaymentRequirements[],
  preferTestnet: boolean = true
): PaymentRequirements | null {
  // Filter to Stellar networks only
  const stellarRequirements = requirements.filter((r) => isStellarNetwork(r.network));

  if (stellarRequirements.length === 0) {
    return null;
  }

  // Prefer testnet or mainnet based on flag
  if (preferTestnet) {
    const testnet = stellarRequirements.find((r) => r.network === "stellar-testnet");
    if (testnet) return testnet;
  } else {
    const mainnet = stellarRequirements.find((r) => r.network === "stellar");
    if (mainnet) return mainnet;
  }

  // Return first available
  return stellarRequirements[0];
}

