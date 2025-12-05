# x402-stellar-express

Express middleware for x402 payments on Stellar. Protect your API routes with instant Stellar payments.

## Installation

```bash
npm install x402-stellar-express express
```

## Quick Start

```typescript
import express from "express";
import { paymentMiddleware } from "x402-stellar-express";

const app = express();

// Protect routes with payments
app.use(
  paymentMiddleware({
    payTo: "GXXXX...", // Your Stellar address
    routes: {
      "/api/premium/*": { price: "1.00" }, // 1 XLM
      "/api/data": { price: "0.50" }, // 0.5 XLM
    },
    facilitator: {
      url: "http://localhost:4022", // Your facilitator URL
    },
  })
);

// Protected routes - payment required!
app.get("/api/premium/content", (req, res) => {
  res.json({ premium: "content" });
});

// Unprotected routes - no payment required
app.get("/api/free", (req, res) => {
  res.json({ free: "content" });
});

app.listen(3000);
```

## Configuration

### Basic Routes

```typescript
app.use(
  paymentMiddleware({
    payTo: "GXXXX...",
    routes: {
      // Simple price (in XLM)
      "/api/premium/*": "1.00",

      // With configuration
      "/api/data": {
        price: "0.50",
        description: "Access to data API",
        maxTimeoutSeconds: 600,
      },

      // Specific HTTP method
      "POST /api/submit": { price: "2.00" },
    },
  })
);
```

### USDC Payments

Accept USDC payments using Stellar Asset Contracts (SAC):

```typescript
// USDC contract addresses
const USDC_TESTNET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const USDC_MAINNET = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

app.use(
  paymentMiddleware({
    payTo: "GXXXX...", // Must have USDC trustline!
    routes: {
      "/api/premium/*": {
        price: "1000000", // 0.1 USDC (7 decimals)
        asset: USDC_TESTNET,
        description: "Premium API access (USDC)",
      },
    },
    facilitator: { url: "http://localhost:4022" },
    network: "stellar-testnet",
  })
);
```

> **Important:** Your receiving address must have a USDC trustline set up before accepting USDC payments.

### Full Configuration

```typescript
app.use(
  paymentMiddleware({
    // Required: Your Stellar address to receive payments
    payTo: "GXXXX...",

    // Required: Routes to protect
    routes: {
      "/api/premium/*": {
        price: "1.00", // Amount in XLM (or stroops as number)
        asset: "native", // "native" for XLM or SAC contract address
        description: "Premium API access",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
      },
    },

    // Optional: Facilitator configuration
    facilitator: {
      url: "http://localhost:4022",
      createAuthHeaders: async () => ({
        verify: { Authorization: "Bearer xxx" },
        settle: { Authorization: "Bearer xxx" },
        supported: {},
      }),
    },

    // Optional: Default network (default: "stellar-testnet")
    network: "stellar-testnet",

    // Optional: Default asset (default: "native")
    asset: "native",
  })
);
```

## Route Patterns

Supports flexible route matching:

```typescript
routes: {
  // Exact match
  "/api/data": "1.00",

  // Wildcard (matches /api/premium/*, /api/premium/foo/bar, etc.)
  "/api/premium/*": "1.00",

  // Parameter syntax (matches /users/123, /users/abc, etc.)
  "/users/[id]": "0.50",

  // HTTP method specific
  "GET /api/read": "0.10",
  "POST /api/write": "0.50",

  // All methods (default)
  "* /api/any": "1.00",
}
```

## How It Works

1. Client makes request to protected route
2. Middleware returns `402 Payment Required` with `accepts` array
3. Client signs payment with their Stellar wallet
4. Client retries request with `X-PAYMENT` header
5. Middleware verifies payment with facilitator
6. If valid, serves content and settles payment
7. Response includes `X-PAYMENT-RESPONSE` header with transaction details

## Response Headers

On successful payment:

```
X-PAYMENT-RESPONSE: base64-encoded JSON {
  success: true,
  transaction: "abc123...",
  network: "stellar-testnet",
  payer: "GXXXX..."
}
```

## Price Formats

```typescript
// XLM as string (human-readable)
price: "1.00"     // 1 XLM
price: "0.50"     // 0.5 XLM
price: "0.001"    // 0.001 XLM

// Stroops as number (atomic units)
price: 10000000   // 1 XLM (10^7 stroops)
price: 5000000    // 0.5 XLM
price: 10000      // 0.001 XLM
```

## Error Responses

When payment is required:

```json
{
  "x402Version": 1,
  "error": "Payment Required",
  "accepts": [
    {
      "scheme": "exact",
      "network": "stellar-testnet",
      "maxAmountRequired": "10000000",
      "payTo": "GXXXX...",
      "asset": "native",
      "resource": "https://api.example.com/premium",
      "description": "Premium API access",
      "mimeType": "application/json",
      "maxTimeoutSeconds": 300
    }
  ]
}
```

## License

MIT

