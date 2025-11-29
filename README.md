# Stellar x402 Ecosystem

Complete Stellar implementation of the [x402 payment protocol](https://github.com/coinbase/x402).

## Packages

| Package | Description |
|---------|-------------|
| [`x402-stellar`](./packages/x402-stellar) | Core library with types, schemas, and facilitator client |
| [`x402-stellar-client`](./packages/x402-stellar-client) | Client SDK for signing payments (Keypair + Freighter) |
| [`x402-stellar-fetch`](./packages/x402-stellar-fetch) | Fetch wrapper that auto-pays 402 responses |
| [`x402-stellar-express`](./packages/x402-stellar-express) | Express middleware for protecting routes |
| [`facilitator`](./packages/facilitator) | Stellar x402 facilitator server |

## Quick Start

### For Wallet/dApp Developers (Pay for APIs)

```bash
npm install x402-stellar-fetch
```

```typescript
import { wrapFetchWithPayment } from "x402-stellar-fetch";
import { Keypair } from "@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("SXXX...");
const fetchWithPay = wrapFetchWithPayment(fetch, { type: "keypair", keypair });

// Automatically handles 402 Payment Required responses
const response = await fetchWithPay("https://api.example.com/premium");
```

### For API Developers (Charge for APIs)

```bash
npm install x402-stellar-express
```

```typescript
import express from "express";
import { paymentMiddleware } from "x402-stellar-express";

const app = express();

app.use(paymentMiddleware(
  "GXXXX...",  // Your Stellar address to receive payments
  {
    "/api/premium/*": { price: "1.00" }  // 1 XLM
  },
  { url: "http://localhost:4022" }  // Facilitator URL
));

app.get("/api/premium/data", (req, res) => {
  res.json({ premium: "content" });
});
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Architecture

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   CLIENT    │         │ RESOURCE SERVER │         │   FACILITATOR   │
│  (Wallet)   │         │   (API Owner)   │         │                 │
└──────┬──────┘         └────────┬────────┘         └────────┬────────┘
       │                         │                           │
       │ x402-stellar-client     │ x402-stellar-express      │ facilitator
       │ x402-stellar-fetch      │                           │
       │                         │                           │
```

## License

MIT

