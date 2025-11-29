# x402-stellar-fetch

Fetch wrapper that automatically handles x402 payments for Stellar.

## Installation

```bash
npm install x402-stellar-fetch @stellar/stellar-sdk
```

## Usage

### Basic Example

```typescript
import { wrapFetchWithPayment, createKeypairSigner } from "x402-stellar-fetch";
import { Keypair } from "@stellar/stellar-sdk";

// Create a signer
const keypair = Keypair.fromSecret("SXXX...");
const signer = createKeypairSigner(keypair);

// Wrap fetch with automatic payment handling
const fetchWithPay = wrapFetchWithPayment(fetch, signer);

// Make requests - payments are handled automatically
const response = await fetchWithPay("https://api.example.com/premium");
const data = await response.json();
```

### With Options

```typescript
const fetchWithPay = wrapFetchWithPayment(fetch, signer, {
  // Maximum payment amount (in stroops, default: 1 XLM)
  maxAmount: BigInt(50_000_000), // 5 XLM max

  // Custom requirement selector
  requirementSelector: (requirements) => {
    // Custom logic to select from multiple payment options
    return requirements.find((r) => r.network === "stellar-testnet")!;
  },
});
```

### With Freighter (Browser)

```typescript
import { wrapFetchWithPayment, createFreighterSigner } from "x402-stellar-fetch";

const signer = createFreighterSigner();
const fetchWithPay = wrapFetchWithPayment(fetch, signer);

// Freighter will prompt user to approve each payment
const response = await fetchWithPay("https://api.example.com/premium");
```

### Getting Payment Info

```typescript
import { wrapFetchWithPayment, decodePaymentResponse } from "x402-stellar-fetch";

const fetchWithPay = wrapFetchWithPayment(fetch, signer);
const response = await fetchWithPay("https://api.example.com/premium");

// Get payment details from response header
const paymentInfo = decodePaymentResponse(response);
if (paymentInfo) {
  console.log(`Transaction: ${paymentInfo.transaction}`);
  console.log(`Network: ${paymentInfo.network}`);
  console.log(`Payer: ${paymentInfo.payer}`);
}
```

## How It Works

1. Makes the initial request
2. If response is 402 Payment Required:
   - Parses `accepts` array from response body
   - Selects a Stellar-compatible payment option
   - Verifies amount is within `maxAmount`
   - Creates and signs a payment transaction
   - Retries request with `X-PAYMENT` header
3. Returns the final response

## API

### `wrapFetchWithPayment(fetch, signer, options?)`

Wraps fetch to automatically handle 402 responses.

**Parameters:**

- `fetch` - The fetch function to wrap
- `signer` - A `StellarSigner` (keypair or Freighter)
- `options.maxAmount` - Maximum payment in stroops (default: 10_000_000 = 1 XLM)
- `options.requirementSelector` - Custom function to select payment requirements

**Returns:** A wrapped fetch function

### `decodePaymentResponse(response)`

Decodes the `X-PAYMENT-RESPONSE` header from a paid request.

**Returns:** `PaymentResponse | null`

### `createKeypairSigner(keypair)`

Create a signer from a Stellar Keypair.

### `createFreighterSigner()`

Create a signer that uses the Freighter wallet.

## License

MIT

