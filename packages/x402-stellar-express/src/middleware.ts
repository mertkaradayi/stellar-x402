/**
 * Express Payment Middleware
 *
 * Protects routes with x402 payments on Stellar.
 * Settlement timing follows Coinbase x402 pattern: settle AFTER route handler succeeds.
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
import { compileRoutePatterns, findMatchingRoute, priceToAtomicUnits } from "./utils.js";
import { getPaywallHtml } from "./paywall/index.js";

/**
 * Check if the request is from a web browser that accepts HTML
 */
function isBrowserRequest(req: Request): boolean {
  const acceptHeader = req.get("Accept") || "";
  const userAgent = req.get("User-Agent") || "";

  // Must accept text/html and look like a browser
  return acceptHeader.includes("text/html") && userAgent.includes("Mozilla");
}

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
    paywall,
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

    console.log(`[x402-middleware] 🔒 Protected route matched: ${req.method} ${req.path}`);

    // Determine the asset for this route
    const routeAsset = routeConfig.asset || asset;

    // Build payment requirements
    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network,
      maxAmountRequired: priceToAtomicUnits(routeConfig.price, routeAsset),
      resource: `${req.protocol}://${req.get("host")}${req.path}`,
      description: routeConfig.description || `Payment for ${req.path}`,
      mimeType: routeConfig.mimeType || "application/json",
      payTo,
      maxTimeoutSeconds: routeConfig.maxTimeoutSeconds || 300,
      asset: routeAsset,
    };

    console.log(`[x402-middleware] 💰 Payment requirements:`, {
      amount: paymentRequirements.maxAmountRequired,
      asset: paymentRequirements.asset,
      network: paymentRequirements.network,
      payTo: paymentRequirements.payTo,
      resource: paymentRequirements.resource,
    });

    // Check for X-PAYMENT header
    const paymentHeader = req.get("X-PAYMENT");

    if (!paymentHeader) {
      console.log(`[x402-middleware] ⚠️  No X-PAYMENT header - requesting payment`);
      // For browser requests, serve the paywall HTML UI
      if (isBrowserRequest(req)) {
        console.log(`[x402-middleware] 🌐 Browser request - serving paywall HTML`);
        const html = getPaywallHtml({
          paymentRequirements,
          currentUrl: req.originalUrl,
          config: paywall,
        });
        res.status(402).type("html").send(html);
        return;
      }

      // For API/programmatic requests, return JSON
      console.log(`[x402-middleware] 📡 API request - returning 402 JSON`);
      res.status(402).json({
        x402Version: 1,
        error: "Payment Required",
        accepts: [paymentRequirements],
      });
      return;
    }

    console.log(`[x402-middleware] ✅ X-PAYMENT header present (length: ${paymentHeader.length})`);

    // Decode and validate payment payload
    let paymentPayload: PaymentPayload;
    try {
      paymentPayload = decodePaymentHeader<PaymentPayload>(paymentHeader);
      console.log(`[x402-middleware] 📦 Payment payload decoded:`, {
        x402Version: paymentPayload.x402Version,
        scheme: paymentPayload.scheme,
        network: paymentPayload.network,
        sourceAccount: paymentPayload.payload.sourceAccount,
        amount: paymentPayload.payload.amount,
        destination: paymentPayload.payload.destination,
      });
    } catch (error) {
      console.error(`[x402-middleware] ❌ Failed to decode payment header:`, error);
      res.status(402).json({
        x402Version: 1,
        error: "Invalid payment header",
        accepts: [paymentRequirements],
      });
      return;
    }

    // Verify payment with facilitator
    try {
      console.log(`[x402-middleware] 🔍 Verifying payment with facilitator...`);
      const verifyResult = await verify(paymentPayload, paymentRequirements);

      if (!verifyResult.isValid) {
        console.error(`[x402-middleware] ❌ Payment verification failed:`, verifyResult.invalidReason);
        res.status(402).json({
          x402Version: 1,
          error: verifyResult.invalidReason || "Payment verification failed",
          accepts: [paymentRequirements],
          payer: verifyResult.payer,
        });
        return;
      }

      console.log(`[x402-middleware] ✅ Payment verified successfully - payer: ${verifyResult.payer}`);

      // Store payment info on request for downstream use
      (req as Request & { x402Payment?: { payload: PaymentPayload; requirements: PaymentRequirements } }).x402Payment = {
        payload: paymentPayload,
        requirements: paymentRequirements,
      };

      // ============================================================
      // Response Buffering: Intercept response methods to delay sending
      // until we've completed settlement. This ensures we only charge
      // users for successful requests.
      // ============================================================
      console.log(`[x402-middleware] 📦 Setting up response buffering - will settle after route handler succeeds`);
      const originalWriteHead = res.writeHead.bind(res);
      const originalWrite = res.write.bind(res);
      const originalEnd = res.end.bind(res);

      type BufferedCall =
        | ["writeHead", Parameters<typeof originalWriteHead>]
        | ["write", Parameters<typeof originalWrite>]
        | ["end", Parameters<typeof originalEnd>];

      let bufferedCalls: BufferedCall[] = [];
      let settled = false;

      res.writeHead = function (...args: Parameters<typeof originalWriteHead>) {
        if (!settled) {
          console.log(`[x402-middleware] 📦 Buffering writeHead: status ${args[0]}`);
          bufferedCalls.push(["writeHead", args]);
          return res;
        }
        return originalWriteHead(...args);
      } as typeof originalWriteHead;

      res.write = function (...args: Parameters<typeof originalWrite>) {
        if (!settled) {
          const dataLength = typeof args[0] === 'string' ? args[0].length : (args[0] as Buffer)?.length || 0;
          console.log(`[x402-middleware] 📦 Buffering write: ${dataLength} bytes`);
          bufferedCalls.push(["write", args]);
          return true;
        }
        return originalWrite(...args);
      } as typeof originalWrite;

      res.end = function (...args: Parameters<typeof originalEnd>) {
        if (!settled) {
          const dataLength = args[0] ? (typeof args[0] === 'string' ? args[0].length : (args[0] as Buffer)?.length || 0) : 0;
          console.log(`[x402-middleware] 📦 Buffering end: ${dataLength} bytes`);
          bufferedCalls.push(["end", args]);
          return res;
        }
        return originalEnd(...args);
      } as typeof originalEnd;

      // Helper to replay buffered calls
      const replayBufferedCalls = () => {
        console.log(`[x402-middleware] 🔄 Replaying ${bufferedCalls.length} buffered response calls...`);
        for (const [method, args] of bufferedCalls) {
          if (method === "writeHead") {
            console.log(`[x402-middleware]   → Replaying writeHead: status ${args[0]}`);
            originalWriteHead(...(args as Parameters<typeof originalWriteHead>));
          } else if (method === "write") {
            const dataLength = typeof args[0] === 'string' ? args[0].length : (args[0] as Buffer)?.length || 0;
            console.log(`[x402-middleware]   → Replaying write: ${dataLength} bytes`);
            originalWrite(...(args as Parameters<typeof originalWrite>));
          } else if (method === "end") {
            const dataLength = args[0] ? (typeof args[0] === 'string' ? args[0].length : (args[0] as Buffer)?.length || 0) : 0;
            console.log(`[x402-middleware]   → Replaying end: ${dataLength} bytes`);
            originalEnd(...(args as Parameters<typeof originalEnd>));
          }
        }
        bufferedCalls = [];
        console.log(`[x402-middleware] ✅ All buffered calls replayed`);
      };

      // Helper to restore original methods
      const restoreResponseMethods = () => {
        settled = true;
        res.writeHead = originalWriteHead;
        res.write = originalWrite;
        res.end = originalEnd;
      };

      // ============================================================
      // Execute route handler
      // ============================================================
      console.log(`[x402-middleware] 🚀 Executing route handler for ${req.method} ${req.path}...`);
      await next();
      console.log(`[x402-middleware] ✅ Route handler completed - status: ${res.statusCode}`);

      // ============================================================
      // Post-route settlement logic
      // ============================================================

      // If the route returned an error (4xx/5xx), don't settle - just replay buffered response
      if (res.statusCode >= 400) {
        console.log(`[x402-middleware] ⚠️  Route returned error status ${res.statusCode} - skipping settlement, replaying error response`);
        restoreResponseMethods();
        replayBufferedCalls();
        return;
      }

      // Route succeeded - now settle the payment
      console.log(`[x402-middleware] 💸 Route succeeded - proceeding to settlement...`);
      try {
        const settleResult = await settle(paymentPayload, paymentRequirements);

        if (settleResult.success) {
          console.log(`[x402-middleware] ✅ Payment settled successfully:`, {
            transaction: settleResult.transaction,
            network: settleResult.network,
            payer: settleResult.payer,
          });
          
          // Add X-PAYMENT-RESPONSE header with settlement details
          res.set(
            "X-PAYMENT-RESPONSE",
            encodePaymentHeader({
              success: true,
              transaction: settleResult.transaction,
              network: settleResult.network,
              payer: settleResult.payer,
            })
          );
          console.log(`[x402-middleware] 📤 Added X-PAYMENT-RESPONSE header`);
          
          // Settlement successful - restore methods and replay buffered response
          console.log(`[x402-middleware] 📥 Replaying buffered response (${bufferedCalls.length} calls)`);
          restoreResponseMethods();
          replayBufferedCalls();
          console.log(`[x402-middleware] ✨ Response sent to client - payment flow complete`);
        } else {
          // Settlement failed - return 402 error instead of the buffered response
          console.error(`[x402-middleware] ❌ Settlement failed:`, settleResult.errorReason);
          restoreResponseMethods();
          bufferedCalls = []; // Discard buffered response
          res.status(402).json({
            x402Version: 1,
            error: settleResult.errorReason || "Payment settlement failed",
            accepts: [paymentRequirements],
            payer: settleResult.payer,
          });
          return;
        }
      } catch (error) {
        // Settlement error - return 402
        console.error("[x402-middleware] ❌ Settlement error:", error);
        restoreResponseMethods();
        bufferedCalls = [];
        res.status(402).json({
          x402Version: 1,
          error: "Payment settlement failed",
          accepts: [paymentRequirements],
        });
        return;
      }
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
