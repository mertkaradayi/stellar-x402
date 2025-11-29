/**
 * Types for Express middleware
 */

import type { FacilitatorConfig, StellarNetwork } from "x402-stellar";

/**
 * Price configuration for a route
 */
export type Price = string | number;

/**
 * Configuration for a single protected route
 */
export interface RouteConfig {
  /** Price in XLM (e.g., "1.00") or stroops (e.g., 10000000) */
  price: Price;
  /** Asset to accept ("native" for XLM or SAC address) */
  asset?: string;
  /** Description of what the payment is for */
  description?: string;
  /** Maximum timeout in seconds */
  maxTimeoutSeconds?: number;
  /** MIME type of the response */
  mimeType?: string;
}

/**
 * Routes configuration map
 * Keys are route patterns (e.g., "/api/premium/*")
 * Values are either a Price or RouteConfig
 */
export type RoutesConfig = Record<string, Price | RouteConfig>;

/**
 * Compiled route pattern for matching
 */
export interface RoutePattern {
  verb: string;
  pattern: RegExp;
  config: RouteConfig;
}

/**
 * Configuration for the middleware
 */
export interface PaymentMiddlewareConfig {
  /** Address to receive payments (Stellar G... address) */
  payTo: string;
  /** Protected routes configuration */
  routes: RoutesConfig;
  /** Facilitator configuration */
  facilitator?: FacilitatorConfig;
  /** Default network (default: "stellar-testnet") */
  network?: StellarNetwork;
  /** Default asset (default: "native") */
  asset?: string;
}

/**
 * Error messages configuration
 */
export interface ErrorMessages {
  paymentRequired?: string;
  invalidPayment?: string;
  verificationFailed?: string;
  settlementFailed?: string;
}

