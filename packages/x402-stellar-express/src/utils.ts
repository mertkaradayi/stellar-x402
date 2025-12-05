/**
 * Utility functions for route matching and payment processing
 */

import type { RouteConfig, RoutesConfig, RoutePattern, Price } from "./types.js";

/**
 * Parse price to atomic units
 * 
 * For native XLM: price is in XLM (e.g., "1.00"), converted to stroops
 * For SAC tokens: price is already in smallest units (e.g., "500000" for 0.05 USDC)
 * 
 * @param price - Price as string (XLM) or number (raw units for SAC tokens)
 * @param asset - Asset type ("native" or contract address)
 * @returns Price in atomic units as string
 */
export function priceToAtomicUnits(price: Price, asset: string = "native"): string {
  // For number inputs, return as-is (already in atomic units)
  if (typeof price === "number") {
    return price.toString();
  }

  // For SAC tokens (non-native), the price should already be in atomic units
  // e.g., "500000" for 0.05 USDC (7 decimals)
  if (asset !== "native") {
    // If it looks like a whole number string, return as-is
    if (/^\d+$/.test(price)) {
      return price;
    }
    // Otherwise, parse as decimal and use 7 decimals (Stellar standard)
    const parsed = parseFloat(price);
    if (isNaN(parsed)) {
      throw new Error(`Invalid price: ${price}`);
    }
    const units = BigInt(Math.floor(parsed * 10_000_000));
    return units.toString();
  }

  // For native XLM: parse string price and convert to stroops
  const parsed = parseFloat(price);
  if (isNaN(parsed)) {
    throw new Error(`Invalid price: ${price}`);
  }

  // Convert XLM to stroops (1 XLM = 10^7 stroops)
  const stroops = BigInt(Math.floor(parsed * 10_000_000));
  return stroops.toString();
}

/**
 * Legacy function - use priceToAtomicUnits instead
 * @deprecated Use priceToAtomicUnits for proper SAC token support
 */
export function priceToStroops(price: Price): string {
  return priceToAtomicUnits(price, "native");
}

/**
 * Normalize route configuration
 */
function normalizeRouteConfig(value: Price | RouteConfig): RouteConfig {
  if (typeof value === "string" || typeof value === "number") {
    return { price: value };
  }
  return value;
}

/**
 * Compile route patterns from configuration
 * 
 * @param routes - Routes configuration
 * @returns Compiled route patterns
 */
export function compileRoutePatterns(routes: RoutesConfig): RoutePattern[] {
  return Object.entries(routes).map(([pattern, value]) => {
    const config = normalizeRouteConfig(value);

    // Split pattern into verb and path
    const [verb, path] = pattern.includes(" ")
      ? pattern.split(/\s+/)
      : ["*", pattern];

    if (!path) {
      throw new Error(`Invalid route pattern: ${pattern}`);
    }

    // Convert pattern to regex
    const regexPattern = path
      // Escape special regex characters except * and []
      .replace(/[$()+.?^{|}]/g, "\\$&")
      // Convert * to match any characters
      .replace(/\*/g, ".*?")
      // Convert [param] to capture group
      .replace(/\[([^\]]+)\]/g, "[^/]+")
      // Escape slashes
      .replace(/\//g, "\\/");

    return {
      verb: verb.toUpperCase(),
      pattern: new RegExp(`^${regexPattern}$`, "i"),
      config,
    };
  });
}

/**
 * Find matching route for a request
 * 
 * @param patterns - Compiled route patterns
 * @param path - Request path
 * @param method - Request method
 * @returns Matching route pattern or undefined
 */
export function findMatchingRoute(
  patterns: RoutePattern[],
  path: string,
  method: string
): RoutePattern | undefined {
  // Normalize path
  const normalizedPath = path
    .split(/[?#]/)[0] // Remove query and hash
    .replace(/\\/g, "/") // Replace backslashes
    .replace(/\/+/g, "/") // Collapse multiple slashes
    .replace(/(.+?)\/+$/, "$1"); // Remove trailing slashes

  const upperMethod = method.toUpperCase();

  // Find matching routes
  const matches = patterns.filter(({ pattern, verb }) => {
    const matchesPath = pattern.test(normalizedPath);
    const matchesVerb = verb === "*" || verb === upperMethod;
    return matchesPath && matchesVerb;
  });

  if (matches.length === 0) {
    return undefined;
  }

  // Return most specific match (longest pattern)
  return matches.reduce((a, b) =>
    b.pattern.source.length > a.pattern.source.length ? b : a
  );
}

