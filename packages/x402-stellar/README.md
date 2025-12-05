# x402-stellar

Core library for the Stellar x402 payment protocol.

## Installation

```bash
npm install x402-stellar
```

## Usage

### Types and Schemas

```typescript
import {
  PaymentPayloadSchema,
  PaymentRequirementsSchema,
  type PaymentPayload,
  type PaymentRequirements,
} from "x402-stellar";

// Validate a payment payload
const result = PaymentPayloadSchema.safeParse(payload);
if (result.success) {
  const validPayload: PaymentPayload = result.data;
}
```

### Facilitator Client

```typescript
import { useFacilitator } from "x402-stellar";

const { verify, settle, supported } = useFacilitator({
  url: "http://localhost:4022",
});

// Get supported payment kinds
const kinds = await supported();

// Verify a payment
const verifyResult = await verify(paymentPayload, paymentRequirements);

// Settle a payment
const settleResult = await settle(paymentPayload, paymentRequirements);
```

### Network Configuration

```typescript
import { STELLAR_NETWORKS } from "x402-stellar";

const testnetConfig = STELLAR_NETWORKS["stellar-testnet"];
console.log(testnetConfig.horizonUrl);
// https://horizon-testnet.stellar.org
```

### Token Catalog (USDC)

```typescript
import { STELLAR_TOKENS, getTokenBySymbol } from "x402-stellar";

// Get USDC contract addresses
const usdcTestnet = STELLAR_TOKENS["stellar-testnet"].USDC;
console.log(usdcTestnet.address);
// CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA

const usdcMainnet = getTokenBySymbol("stellar", "USDC");
console.log(usdcMainnet?.address);
// CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
```

## Exports

- `x402-stellar` - Main entry point with all exports
- `x402-stellar/types` - Types and Zod schemas only
- `x402-stellar/shared` - Shared utilities (base64, JSON)
- `x402-stellar/verify` - Facilitator client

## License

MIT

