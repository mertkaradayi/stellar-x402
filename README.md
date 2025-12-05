# Stellar x402 Ecosystem

> Complete Stellar implementation of the [x402 payment protocol](https://github.com/coinbase/x402).  
> "1 line of code to accept digital dollars on Stellar. No fees, 2-second settlement, $0.001 minimum payment."

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

## What is x402?

The [x402 payment protocol](https://github.com/coinbase/x402) is an open standard for internet-native payments that leverages the existing `402 Payment Required` HTTP status code. It enables:

- **Chain-agnostic payments** - Works across different blockchains
- **Gasless for clients** - Facilitators can sponsor transaction fees
- **Minimal integration** - 1 line for servers, 1 function for clients
- **Low minimums** - Support for micropayments ($0.001+)
- **Fast settlement** - 2-5 second confirmation times

## What Makes Stellar x402 Different?

This implementation brings x402 to the **Stellar network**, offering unique advantages:

### 🚀 **Ultra-Fast Settlement**
- **2-5 second confirmation** - Stellar's consensus protocol enables near-instant finality
- **Ledger-based expiry** - Transactions expire based on ledger sequence, not block height or timestamps
- **No gas wars** - Fixed, predictable transaction fees

### 💰 **True Gasless Payments**
- **Fee sponsorship via fee-bump** - Facilitators can pay transaction fees on behalf of clients
- **Trust-minimized** - Client's signed transaction is never modified; only fee payer changes
- **Optional fee sponsorship** - Works with or without facilitator fee sponsorship

### 🔐 **Native Stellar Features**
- **XDR transaction format** - Uses Stellar's native XDR (eXternal Data Representation) for transactions
- **Built-in replay protection** - Stellar's sequence numbers prevent transaction replay at protocol level
- **Native XLM support** - Direct XLM payments without token contracts
- **USDC support** - Pay with USDC via Stellar Asset Contracts (SAC) on testnet and mainnet

### 🌐 **Browser-First Experience**
- **Freighter wallet integration** - Seamless browser payments with the most popular Stellar wallet
- **Beautiful paywall UI** - Pre-built, responsive payment interface for web apps
- **No RPC required** - Clients don't need direct blockchain access

### 📦 **Complete Ecosystem**
- **5 specialized packages** - Modular architecture for different use cases
- **100% x402 compliant** - Fully compatible with the x402 specification
- **Type-safe** - Full TypeScript support with Zod validation

### Comparison with Other x402 Implementations

| Feature | EVM (Coinbase) | Stellar (Ours) |
|---------|---------------|---------------|
| **Transaction Format** | Signature-based | XDR (signed transaction) |
| **Fee Sponsorship** | Meta-transactions | Fee-bump transactions |
| **Settlement Time** | ~12 seconds | **2-5 seconds** |
| **Expiry Mechanism** | Timestamp (`validBefore`) | Ledger sequence (`validUntilLedger`) |
| **Native Asset** | Requires ERC-20 | **Native XLM** |
| **Replay Protection** | Nonce-based | **Sequence numbers** (protocol-level) |
| **Browser Wallet** | MetaMask | **Freighter** |

## Protocol Format Comparison

Here's a detailed look at the actual JSON structures used in Stellar x402 vs the base x402 protocol. This helps you understand the differences at a glance.

### 1. Payment Required Response (402 Response)

When a server requires payment, it returns a `402 Payment Required` status with this structure:

**Base x402 Format (EVM Example):**
```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base-sepolia",
      "maxAmountRequired": "1000000",  // 1 USDC (6 decimals)
      "resource": "https://api.example.com/premium",
      "description": "Premium API access",
      "mimeType": "application/json",
      "payTo": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      "maxTimeoutSeconds": 300,
      "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  // USDC contract
      "extra": {
        "name": "USD Coin",
        "version": "2"
      }
    }
  ],
  "error": null
}
```

**Stellar x402 Format:**
```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "stellar-testnet",
      "maxAmountRequired": "10000000",  // 1 XLM (7 decimals = stroops)
      "resource": "https://api.example.com/premium",
      "description": "Premium API access",
      "mimeType": "application/json",
      "payTo": "GC63PSERYMUUUJKYSSFQ7FKRAU5UPIP3XUC6X7DLMZUB7SSCPW5BSIRT",
      "maxTimeoutSeconds": 300,
      "asset": "native",  // Native XLM (no contract needed!)
      "extra": {
        "feeSponsorship": true  // Facilitator can pay fees
      }
    }
  ],
  "error": null
}
```

**Key Differences:**
- `network`: `"stellar-testnet"` vs `"base-sepolia"`
- `asset`: `"native"` for XLM (no contract) vs ERC-20 contract address
- `maxAmountRequired`: Stroops (7 decimals) vs wei/token units (varies)
- `payTo`: Stellar address (`G...`) vs EVM address (`0x...`)
- `extra`: Stellar-specific fields like `feeSponsorship`

### 2. Payment Payload (X-PAYMENT Header)

The client sends this as the `X-PAYMENT` header (base64-encoded JSON):

**Base x402 Format (EVM - Signature-based):**
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base-sepolia",
  "payload": {
    "signature": "0x2d6a7588d6acca505cbf0d9a4a227e0c52c6c34008c8e8986a1283259764173608a2ce6496642e377d6da8dbbf5836e9bd15092f9ecab05ded3d6293af148b571c",
    "authorization": {
      "from": "0x857b06519E91e3A54538791bDbb0E22373e36b66",
      "to": "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      "value": "1000000",
      "validAfter": "1740672089",
      "validBefore": "1740672154",
      "nonce": "0xf3746613c2d920b5fdabc0856f2aeb2d4f88ee6037b8cc5d04a71a4462f13480"
    }
  }
}
```

**Stellar x402 Format (XDR-based):**
```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "stellar-testnet",
  "payload": {
    "signedTxXdr": "AAAAAgAAAAA...",  // Base64-encoded signed transaction
    "sourceAccount": "GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234",
    "amount": "10000000",  // Stroops (1 XLM)
    "destination": "GC63PSERYMUUUJKYSSFQ7FKRAU5UPIP3XUC6X7DLMZUB7SSCPW5BSIRT",
    "asset": "native",
    "validUntilLedger": 12345678,  // Ledger sequence number
    "nonce": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Key Differences:**

| Field | EVM (Coinbase) | Stellar (Ours) |
|-------|---------------|----------------|
| **Transaction Format** | `signature` + `authorization` object | `signedTxXdr` (complete signed transaction) |
| **Payer Address** | `authorization.from` | `sourceAccount` |
| **Amount** | `authorization.value` | `amount` |
| **Destination** | `authorization.to` | `destination` |
| **Expiry** | `validBefore` (Unix timestamp) | `validUntilLedger` (ledger sequence) |
| **Nonce** | Hex string in `authorization` | String in payload root |
| **Asset** | N/A (inferred from contract) | `asset` field (`"native"` or contract) |

**Why XDR?**
- Stellar uses XDR (eXternal Data Representation) for all transactions
- The `signedTxXdr` contains the complete, signed transaction ready for submission
- Facilitator can optionally fee-bump without modifying the client's transaction
- Built-in replay protection via Stellar's sequence numbers

### 3. Facilitator Verify Request

**Base x402 Format:**
```json
{
  "x402Version": 1,
  "paymentPayload": { /* PaymentPayload object */ },
  "paymentRequirements": { /* PaymentRequirements object */ }
}
```

**Stellar x402 Format (Compatible, with flexibility):**
```json
{
  "x402Version": 1,
  "paymentPayload": { /* PaymentPayload object */ },  // OR
  "paymentHeader": "base64-encoded-payment-header",   // Alternative format
  "paymentRequirements": { /* PaymentRequirements object */ }
}
```

**Note:** Stellar facilitator accepts both `paymentPayload` (JSON object) and `paymentHeader` (base64 string) for flexibility.

### 4. Facilitator Verify Response

**Both Formats (Identical):**
```json
{
  "isValid": true,
  "invalidReason": null,
  "payer": "GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234"
}
```

### 5. Facilitator Settle Response

**Both Formats (Identical):**
```json
{
  "success": true,
  "errorReason": null,
  "payer": "GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234",
  "transaction": "abc123def456...",  // Transaction hash
  "network": "stellar-testnet"
}
```

### 6. Payment Response Header (X-PAYMENT-RESPONSE)

After successful payment, the server includes this in the response header:

**Both Formats (Identical):**
```json
{
  "success": true,
  "transaction": "abc123def456...",
  "network": "stellar-testnet",
  "payer": "GABCDEFGHIJKLMNOPQRSTUVWXYZ2345678901234"
}
```

**Sent as:** `X-PAYMENT-RESPONSE: <base64-encoded-json>`

## Summary of Format Differences

| Aspect | EVM (Coinbase) | Stellar (Ours) |
|--------|---------------|----------------|
| **Payment Structure** | Signature + authorization object | Complete signed XDR transaction |
| **Address Format** | `0x...` (42 chars) | `G...` (56 chars, base32) |
| **Amount Decimals** | Varies (USDC: 6, ETH: 18) | Fixed (XLM: 7 stroops) |
| **Expiry** | Unix timestamp (`validBefore`) | Ledger sequence (`validUntilLedger`) |
| **Native Asset** | Requires ERC-20 contract | `"native"` (no contract) |
| **Transaction Format** | EIP-712 typed data signature | XDR-encoded transaction |
| **Fee Sponsorship** | Meta-transactions | Fee-bump transactions |
| **Replay Protection** | Nonce in authorization | Sequence numbers (protocol-level) |

## Packages

| Package | Description | Use Case |
|---------|-------------|----------|
| [`x402-stellar`](./packages/x402-stellar) | Core library with types, schemas, and facilitator client | Building custom integrations |
| [`x402-stellar-client`](./packages/x402-stellar-client) | Client SDK for signing payments (Keypair + Freighter) | Client applications |
| [`x402-stellar-fetch`](./packages/x402-stellar-fetch) | Fetch wrapper that auto-pays 402 responses | Simple client integrations |
| [`x402-stellar-express`](./packages/x402-stellar-express) | Express middleware for protecting routes | Node.js/Express servers |
| [`facilitator`](./packages/facilitator) | Stellar x402 facilitator server | Payment verification & settlement |

## Quick Start

### For Wallet/dApp Developers (Pay for APIs)

Install the fetch wrapper:

```bash
npm install x402-stellar-fetch @stellar/stellar-sdk
```

**With Keypair (Backend/Scripts):**

```typescript
import { wrapFetchWithPayment, createKeypairSigner } from "x402-stellar-fetch";
import { Keypair } from "@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("SXXX...");
const signer = createKeypairSigner(keypair);
const fetchWithPay = wrapFetchWithPayment(fetch, signer);

// Automatically handles 402 Payment Required responses
const response = await fetchWithPay("https://api.example.com/premium");
const data = await response.json();
```

**With Freighter (Browser):**

```typescript
import { wrapFetchWithPayment, createFreighterSigner } from "x402-stellar-fetch";

const signer = createFreighterSigner();
const fetchWithPay = wrapFetchWithPayment(fetch, signer);

// Freighter will prompt user to approve payment
const response = await fetchWithPay("https://api.example.com/premium");
```

### For API Developers (Charge for APIs)

Install the Express middleware:

```bash
npm install x402-stellar-express express
```

**Accept XLM payments:**

```typescript
import express from "express";
import { paymentMiddleware } from "x402-stellar-express";

const app = express();

// Protect routes with payments - that's it!
app.use(paymentMiddleware({
  payTo: "GXXXX...",  // Your Stellar address to receive payments
  routes: {
    "/api/premium/*": { price: "1.00" }  // 1 XLM
  },
  facilitator: { url: "http://localhost:4022" },
  // Optional: Enable browser-friendly paywall UI
  paywall: { appName: "My API" },
}));

app.get("/api/premium/data", (req, res) => {
  res.json({ premium: "content" });
});

app.listen(3000);
```

**Accept USDC payments:**

```typescript
// USDC contract addresses
const USDC_TESTNET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const USDC_MAINNET = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

app.use(paymentMiddleware({
  payTo: "GXXXX...",  // Must have USDC trustline!
  routes: {
    "/api/premium/*": {
      price: "1000000",  // 0.1 USDC (7 decimals)
      asset: USDC_TESTNET,
      description: "Premium API access (USDC)"
    }
  },
  facilitator: { url: "http://localhost:4022" },
  network: "stellar-testnet",
}));
```

> **Important:** Your receiving address (`payTo`) must have a USDC trustline set up before accepting USDC payments.

## Architecture

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────────┐
│   CLIENT    │         │ RESOURCE SERVER │         │   FACILITATOR   │
│  (Wallet)   │         │   (API Owner)   │         │                 │
└──────┬──────┘         └────────┬────────┘         └────────┬────────┘
       │                         │                           │
       │ 1. Request              │                           │
       ├────────────────────────>│                           │
       │                         │                           │
       │ 2. 402 Payment Required  │                           │
       │<────────────────────────┤                           │
       │                         │                           │
       │ 3. Sign payment (XDR)   │                           │
       │    with Freighter/      │                           │
       │    Keypair              │                           │
       │                         │                           │
       │ 4. Request + X-PAYMENT   │                           │
       ├────────────────────────>│                           │
       │                         │                           │
       │                         │ 5. Verify payment         │
       │                         ├──────────────────────────>│
       │                         │                           │
       │                         │ 6. Verification result     │
       │                         │<──────────────────────────┤
       │                         │                           │
       │                         │ 7. Serve content          │
       │                         │                           │
       │                         │ 8. Settle payment         │
       │                         ├──────────────────────────>│
       │                         │                           │
       │                         │ 9. Submit to Stellar      │
       │                         │    (with optional         │
       │                         │     fee-bump)             │
       │                         │                           │
       │                         │ 10. Settlement result      │
       │                         │<──────────────────────────┤
       │                         │                           │
       │ 11. 200 OK + Content    │                           │
       │     + X-PAYMENT-RESPONSE │                           │
       │<────────────────────────┤                           │
       │                         │                           │
```

## Development

### Prerequisites

- **Node.js** v18 or higher
- **pnpm** v8 or higher
- **Stellar testnet account** (fund via [friendbot](https://friendbot.stellar.org))

### Setup

```bash
# Clone the repository
git clone https://github.com/your-org/stellar-x402.git
cd stellar-x402

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Running Examples

The easiest way to test everything:

```bash
# Terminal 1: Start facilitator
cd packages/facilitator
pnpm dev

# Terminal 2: Start example server
cd examples/server-example
pnpm install  # First time only
pnpm start

# Terminal 3: Open in browser
# Visit: http://localhost:3000
# Click any protected endpoint
# Connect Freighter wallet and pay!
```

**Payment Address:** `GC63PSERYMUUUJKYSSFQ7FKRAU5UPIP3XUC6X7DLMZUB7SSCPW5BSIRT`

See [examples/README.md](./examples/README.md) for more details.

## Testing

See [TESTING.md](./TESTING.md) for comprehensive testing guide.

## Protocol Compliance

This implementation is **100% compliant** with the [x402 specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md):

- ✅ All facilitator endpoints (`/verify`, `/settle`, `/supported`)
- ✅ Payment payload and requirements schemas
- ✅ Error codes and response formats
- ✅ Replay protection and idempotency
- ✅ Trust-minimized payment flows

See [packages/facilitator/X402_COMPLIANCE_STATUS.md](./packages/facilitator/X402_COMPLIANCE_STATUS.md) for detailed compliance documentation.

## Key Features

### 🔒 **Security**
- **Trust-minimized** - Facilitators cannot move funds without client signatures
- **Replay protection** - Redis-backed transaction hash tracking
- **Idempotency** - Cached settlement results prevent duplicate payments
- **Zod validation** - Type-safe request/response validation

### ⚡ **Performance**
- **Fast settlement** - 2-5 second confirmation on Stellar
- **Optional fee sponsorship** - Gasless payments for clients
- **Efficient verification** - Local and remote verification support
- **Response buffering** - Settles payments after route success

### 🎨 **Developer Experience**
- **TypeScript first** - Full type safety and IntelliSense
- **Modular packages** - Use only what you need
- **Beautiful paywall** - Pre-built UI for web applications
- **Comprehensive examples** - Browser and programmatic clients

### 🌍 **Ecosystem**
- **Freighter integration** - Most popular Stellar wallet
- **Express middleware** - Drop-in payment protection
- **Fetch wrapper** - Automatic payment handling
- **Discovery API** - Resource registration and discovery

## Network & Asset Support

### Networks

| Network | ID | Status |
|---------|-----|--------|
| Stellar Testnet | `stellar-testnet` | ✅ Supported |
| Stellar Mainnet | `stellar` | ✅ Supported |

### Supported Assets

| Asset | Testnet Contract | Mainnet Contract |
|-------|------------------|------------------|
| **XLM** | `native` | `native` |
| **USDC** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

### Setting Up USDC Trustline

Before accepting USDC payments, your receiving address must have a USDC trustline:

```bash
# Using Stellar CLI
stellar tx new change-trust \
    --line USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5 \
    --source-account YOUR_ADDRESS \
    --network testnet \
    --sign-with-key YOUR_SECRET_KEY
```

Or use [Stellar Laboratory](https://laboratory.stellar.org/#txbuilder) to add a trustline via the web UI.

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for our development plans, upcoming features, and community contribution opportunities.

## Contributing

Contributions are welcome! Please see our contributing guidelines for details.

## License

MIT

---

**Built with ❤️ for the Stellar ecosystem**
