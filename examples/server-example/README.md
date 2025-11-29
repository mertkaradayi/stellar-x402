# Server Example

Example Express server with x402 payment protection.

## Setup

1. Replace `PAY_TO` in `src/index.ts` with your Stellar address
2. Start your facilitator (from `packages/facilitator`)
3. Run this server

## Running

```bash
# Install dependencies
pnpm install

# Start the server
pnpm start
```

## Testing

Free endpoint:
```bash
curl http://localhost:3000/
```

Protected endpoint (returns 402):
```bash
curl http://localhost:3000/api/premium/content
```

To access protected endpoints, use a client with payment support (see client-example).

