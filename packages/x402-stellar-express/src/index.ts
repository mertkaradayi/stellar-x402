/**
 * x402-stellar-express - Express middleware for x402 payments on Stellar
 *
 * Protect your Express routes with Stellar payments using the x402 protocol.
 */

export { paymentMiddleware, createPaymentMiddleware } from "./middleware.js";

export type {
  PaymentMiddlewareConfig,
  RoutesConfig,
  RouteConfig,
  RoutePattern,
  Price,
  ErrorMessages,
} from "./types.js";

export { compileRoutePatterns, findMatchingRoute, priceToStroops } from "./utils.js";

// Re-export useful types from x402-stellar
export type {
  PaymentRequirements,
  PaymentPayload,
  FacilitatorConfig,
  StellarNetwork,
} from "x402-stellar";

