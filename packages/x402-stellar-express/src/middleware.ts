/**
 * Express Payment Middleware
 *
 * Protects routes with x402 payments on Stellar.
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import {
  type PaymentRequirements,
  type PaymentPayload,
  useFacilitator,
  decodePaymentHeader,
  encodePaymentHeader,
  StellarAddressRegex,
} from "x402-stellar";
import type { PaymentMiddlewareConfig, RoutesConfig } from "./types.js";
import { compileRoutePatterns, findMatchingRoute, priceToStroops } from "./utils.js";

/**
 * Create payment middleware for Express
 *
 * @param config - Middleware configuration
 * @returns Express middleware handler
 *
 * @example
 * ```typescript
 * import express from "express";
 * import { paymentMiddleware } from "x402-stellar-express";
 *
 * const app = express();
 *
 * app.use(paymentMiddleware({
 *   payTo: "GXXXX...",
 *   routes: {
 *     "/api/premium/*": { price: "1.00" },
 *     "POST /api/data": { price: "0.50", description: "Data API" },
 *   },
 *   facilitator: { url: "http://localhost:4022" },
 * }));
 *
 * app.get("/api/premium/content", (req, res) => {
 *   res.json({ premium: "content" });
 * });
 * ```
 */
export function paymentMiddleware(config: PaymentMiddlewareConfig): RequestHandler {
  const {
    payTo,
    routes,
    facilitator,
    network = "stellar-testnet",
    asset = "native",
  } = config;

  // Validate payTo address
  if (!StellarAddressRegex.test(payTo)) {
    throw new Error(`Invalid payTo address: ${payTo}`);
  }

  // Create facilitator client
  const { verify, settle } = useFacilitator(facilitator);

  // Compile route patterns
  const routePatterns = compileRoutePatterns(routes);

  return async function paymentMiddlewareHandler(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    // Find matching route
    const matchingRoute = findMatchingRoute(routePatterns, req.path, req.method);

    if (!matchingRoute) {
      // Not a protected route, pass through
      return next();
    }

    const routeConfig = matchingRoute.config;

    // Build payment requirements
    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network,
      maxAmountRequired: priceToStroops(routeConfig.price),
      resource: `${req.protocol}://${req.get("host")}${req.path}`,
      description: routeConfig.description || `Payment for ${req.path}`,
      mimeType: routeConfig.mimeType || "application/json",
      payTo,
      maxTimeoutSeconds: routeConfig.maxTimeoutSeconds || 300,
      asset: routeConfig.asset || asset,
    };

    // Check for X-PAYMENT header
    const paymentHeader = req.get("X-PAYMENT");

    if (!paymentHeader) {
      // Return 402 Payment Required
      res.status(402).json({
        x402Version: 1,
        error: "Payment Required",
        accepts: [paymentRequirements],
      });
      return;
    }

    // Decode and validate payment payload
    let paymentPayload: PaymentPayload;
    try {
      paymentPayload = decodePaymentHeader<PaymentPayload>(paymentHeader);
    } catch (error) {
      res.status(402).json({
        x402Version: 1,
        error: "Invalid payment header",
        accepts: [paymentRequirements],
      });
      return;
    }

    // Verify payment with facilitator
    try {
      const verifyResult = await verify(paymentPayload, paymentRequirements);

      if (!verifyResult.isValid) {
        res.status(402).json({
          x402Version: 1,
          error: verifyResult.invalidReason || "Payment verification failed",
          accepts: [paymentRequirements],
          payer: verifyResult.payer,
        });
        return;
      }

      // Store payment info for later settlement
      (req as Request & { x402Payment?: { payload: PaymentPayload; requirements: PaymentRequirements } }).x402Payment = {
        payload: paymentPayload,
        requirements: paymentRequirements,
      };

      // Continue to the protected route
      // We'll settle after the response is sent

      // Hook into response finish event
      res.on("finish", async () => {
        // Only settle if response was successful (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const settleResult = await settle(paymentPayload, paymentRequirements);

            if (settleResult.success) {
              // Add payment response header (already sent, but log for debugging)
              console.log(`[x402] Payment settled: ${settleResult.transaction}`);
            } else {
              console.error(`[x402] Settlement failed: ${settleResult.errorReason}`);
            }
          } catch (error) {
            console.error("[x402] Settlement error:", error);
          }
        }
      });

      // Set payment response header before passing to next handler
      const settleResult = await settle(paymentPayload, paymentRequirements);

      if (settleResult.success) {
        res.set(
          "X-PAYMENT-RESPONSE",
          encodePaymentHeader({
            success: true,
            transaction: settleResult.transaction,
            network: settleResult.network,
            payer: settleResult.payer,
          })
        );
      }

      next();
    } catch (error) {
      console.error("[x402] Verification error:", error);
      res.status(500).json({
        x402Version: 1,
        error: "Payment verification error",
      });
    }
  };
}

/**
 * Simplified middleware factory
 *
 * @param payTo - Address to receive payments
 * @param routes - Routes configuration
 * @param facilitator - Optional facilitator config
 * @returns Express middleware
 */
export function createPaymentMiddleware(
  payTo: string,
  routes: RoutesConfig,
  facilitator?: { url: string }
): RequestHandler {
  return paymentMiddleware({
    payTo,
    routes,
    facilitator,
  });
}

