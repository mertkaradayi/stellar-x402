/**
 * Utility functions for route matching and payment processing
 */

import type { RouteConfig, RoutesConfig, RoutePattern, Price } from "./types.js";

/**
 * Parse price to stroops (atomic units)
 * 
 * @param price - Price as string (e.g., "1.00") or number (stroops)
 * @returns Price in stroops as string
 */
export function priceToStroops(price: Price): string {
  if (typeof price === "number") {
    return price.toString();
  }

  // Parse string price (assumed to be in XLM)
  const parsed = parseFloat(price);
  if (isNaN(parsed)) {
    throw new Error(`Invalid price: ${price}`);
  }

  // Convert XLM to stroops (1 XLM = 10^7 stroops)
  const stroops = BigInt(Math.floor(parsed * 10_000_000));
  return stroops.toString();
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

