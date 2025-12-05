# Stellar x402 Example Server

A simple, runnable example server that demonstrates Stellar x402 payments with both XLM and USDC.

## Quick Start

### 1. Start the Facilitator

In a separate terminal, start the facilitator server:

```bash
cd ../../packages/facilitator
pnpm dev
```

The facilitator will run on `http://localhost:4022`

### 2. Start This Server

```bash
# Install dependencies (if not already done)
pnpm install

# Start the server
pnpm start
```

The server will run on `http://localhost:3000`

### 3. Test in Browser

1. Open your browser and go to: `http://localhost:3000`
2. Click on any protected endpoint (e.g., "Premium Content")
3. You'll see the payment UI
4. Connect your Freighter wallet (make sure it's on Stellar Testnet)
5. Approve the payment
6. Access the protected content!

## Payment Address

All payments go to: `GC63PSERYMUUUJKYSSFQ7FKRAU5UPIP3XUC6X7DLMZUB7SSCPW5BSIRT`

## Endpoints

### Free Endpoints
- `GET /` - Home page (HTML or JSON)
- `GET /health` - Health check

### XLM Protected Endpoints (Native XLM Payment)
- `GET /api/premium/content` - Premium content (1 XLM)
- `GET /api/premium/stats` - Premium statistics (1 XLM)
- `GET /api/data` - Data API (0.5 XLM)

### USDC Protected Endpoints (SAC Token Payment)
- `GET /api/usdc/premium/content` - Premium content (0.1 USDC)
- `GET /api/usdc/data` - Data API (0.05 USDC)

## Asset Configuration

This example uses:
- **Native XLM** for `/api/*` routes
- **USDC (Testnet)** for `/api/usdc/*` routes

USDC Testnet Contract: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`

## Testing

### Browser Testing (Freighter Wallet)

The browser paywall supports both **XLM** and **USDC** payments via Freighter:

1. Make sure [Freighter wallet](https://freighter.app) is installed and connected to Stellar Testnet
2. Visit `http://localhost:3000` in your browser
3. Click any protected endpoint:
   - XLM: `/api/data` or `/api/premium/content`
   - USDC: `/api/usdc/data` or `/api/usdc/premium/content`
4. The paywall UI will appear showing the price (e.g., "0.05 USDC")
5. Connect Freighter and approve the payment
6. You'll see the protected content!

**USDC Browser Flow:**
The browser paywall builds a Soroban contract call (SEP-41 `transfer`), simulates it via Soroban RPC, and signs with Freighter. The facilitator then submits the transaction.

### Programmatic Testing (SDK)

Use the `x402-stellar-client` SDK for server-to-server or automated payments:

```bash
cd ../client-example
STELLAR_SECRET_KEY=YOUR_SECRET_KEY pnpm start
```

**When to use the SDK vs Browser:**

| Use Case | Recommended Approach |
|----------|---------------------|
| Web app with user interaction | Browser paywall + Freighter |
| Backend service / automation | `x402-stellar-client` SDK |
| Testing without wallet | SDK with keypair signer |
| MCP / Agent payments | SDK with keypair signer |

## Getting Testnet Tokens

**XLM:** Fund your wallet via Friendbot:
```bash
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

**USDC:** Get testnet USDC from [Circle Faucet](https://faucet.circle.com/) or swap XLM for USDC on a testnet DEX.

## Troubleshooting

**"ECONNREFUSED" error:**
- Make sure the facilitator is running on port 4022
- Check: `curl http://localhost:4022/health`

**Paywall not showing:**
- Make sure you're accessing via browser (not curl)
- Check browser console for errors
- Verify Freighter is installed

**Payment fails:**
- Make sure your Freighter wallet is on Stellar Testnet
- Ensure you have testnet XLM/USDC in your wallet

