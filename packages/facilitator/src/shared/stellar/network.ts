/**
 * Stellar Network Configuration
 *
 * Following Coinbase x402 pattern: shared/stellar/network.ts
 */

// Network configuration for Stellar
export const STELLAR_NETWORKS = {
  "stellar-testnet": {
    horizonUrl: "https://horizon-testnet.stellar.org",
    sorobanRpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
  stellar: {
    horizonUrl: "https://horizon.stellar.org",
    sorobanRpcUrl: "https://soroban.stellar.org",
    networkPassphrase: "Public Global Stellar Network ; September 2015",
  },
} as const;

export type StellarNetworkId = keyof typeof STELLAR_NETWORKS;
export type StellarNetworkConfig = (typeof STELLAR_NETWORKS)[StellarNetworkId];

