/**
 * Well-Known Stellar Token Catalog
 *
 * Registry of verified SAC token addresses for USDC and other tokens.
 * Addresses from Coinbase x402 token catalog for compatibility.
 */

import type { StellarNetworkId } from "./network.js";

/**
 * Token metadata
 */
export interface StellarToken {
    /** SAC contract address (C...) */
    address: `C${string}`;
    /** Number of decimal places */
    decimals: number;
    /** Token symbol (e.g., "USDC") */
    symbol: string;
    /** Human-readable name */
    name: string;
}

/**
 * Well-known token catalog per network
 */
export const STELLAR_TOKENS: Record<StellarNetworkId, Record<string, StellarToken>> = {
    "stellar-testnet": {
        USDC: {
            address: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
            decimals: 7,
            symbol: "USDC",
            name: "USD Coin",
        },
    },
    stellar: {
        USDC: {
            address: "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
            decimals: 7,
            symbol: "USDC",
            name: "USD Coin",
        },
    },
};

/**
 * Get token info by address
 */
export function getTokenByAddress(
    network: StellarNetworkId,
    address: string
): StellarToken | undefined {
    const tokens = STELLAR_TOKENS[network];
    return Object.values(tokens).find((t) => t.address === address);
}

/**
 * Get token info by symbol
 */
export function getTokenBySymbol(
    network: StellarNetworkId,
    symbol: string
): StellarToken | undefined {
    return STELLAR_TOKENS[network][symbol];
}

/**
 * Check if an asset is a SAC token (C...)
 */
export function isSacToken(asset: string): boolean {
    return /^C[A-Z2-7]{55}$/.test(asset);
}

/**
 * Check if an asset is native XLM
 */
export function isNativeAsset(asset: string): boolean {
    return asset === "native";
}
