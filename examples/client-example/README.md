# Client Example

Example client that automatically pays for APIs using x402.

## Setup

1. Generate a Stellar keypair:

```bash
node -e "const { Keypair } = require('@stellar/stellar-sdk'); const kp = Keypair.random(); console.log('Public:', kp.publicKey()); console.log('Secret:', kp.secret());"
```

2. Fund it on testnet:

```bash
curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
```

3. Start the server example (in another terminal):

```bash
cd ../server-example
pnpm install
pnpm start
```

4. Start the facilitator (in another terminal):

```bash
cd ../../packages/facilitator
pnpm start
```

## Running

```bash
# Install dependencies
pnpm install

# Run with your secret key
STELLAR_SECRET_KEY=SXXX... pnpm start
```

## How It Works

1. Client makes request to protected endpoint
2. Server returns 402 Payment Required
3. `wrapFetchWithPayment` automatically:
   - Parses the payment requirements
   - Creates and signs a Stellar transaction
   - Retries the request with X-PAYMENT header
4. Server verifies payment and returns content
5. Client receives the protected data

