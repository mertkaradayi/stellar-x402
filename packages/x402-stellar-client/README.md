# x402-stellar-client

Client SDK for signing Stellar x402 payments. Supports both Stellar Keypair (for backends/scripts) and Freighter wallet (for browsers).

## Installation

```bash
npm install x402-stellar-client @stellar/stellar-sdk
```

For Freighter support in browsers:

```bash
npm install @stellar/freighter-api
```

## Usage

### With Keypair (Backends/Scripts)

```typescript
import { createPaymentHeader, createKeypairSigner } from "x402-stellar-client";
import { Keypair } from "@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("SXXX...");
const signer = createKeypairSigner(keypair);

const xPayment = await createPaymentHeader({
  signer,
  paymentRequirements: {
    scheme: "exact",
    network: "stellar-testnet",
    maxAmountRequired: "10000000", // 1 XLM in stroops
    payTo: "GXXXX...",
    asset: "native",
    resource: "https://api.example.com/premium",
    description: "Premium API access",
    mimeType: "application/json",
    maxTimeoutSeconds: 300,
  },
});

// Use in request
const response = await fetch("https://api.example.com/premium", {
  headers: {
    "X-PAYMENT": xPayment,
  },
});
```

### With Freighter (Browsers)

```typescript
import { createPaymentHeader, createFreighterSigner } from "x402-stellar-client";

const signer = createFreighterSigner();

const xPayment = await createPaymentHeader({
  signer,
  paymentRequirements: requirements,
});

// Freighter will prompt the user to approve the transaction
```

### Selecting Payment Requirements

When you receive a 402 response with multiple payment options:

```typescript
import { selectPaymentRequirements } from "x402-stellar-client";

// From 402 response
const accepts = response.accepts;

// Select Stellar payment option
const requirements = selectPaymentRequirements(
  accepts,
  "stellar-testnet", // preferred network
  "exact" // scheme
);
```

## API

### `createPaymentHeader(options)`

Main entry point for creating signed X-PAYMENT headers.

**Options:**

- `signer` - The signer to use (keypair or Freighter)
- `paymentRequirements` - The payment requirements from 402 response
- `x402Version` - The x402 version (default: 1)
- `timeoutSeconds` - Optional timeout override

**Returns:** Base64-encoded payment header string

### `createPaymentPayload(options)`

Same as `createPaymentHeader` but returns the raw `PaymentPayload` object.

### `createKeypairSigner(keypair)`

Create a signer from a Stellar Keypair.

### `createFreighterSigner()`

Create a signer that uses the Freighter wallet.

### `selectPaymentRequirements(requirements, network?, scheme?)`

Select payment requirements from a list of options.

## License

MIT

