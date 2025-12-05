# x402 MCP Example Client

This is an example client that demonstrates how to use the x402 payment protocol with the Model Context Protocol (MCP) to make paid API requests through an MCP server on the Stellar network.

## Prerequisites

- **Node.js** v18+ (install via [nvm](https://github.com/nvm-sh/nvm))
- **pnpm** v8+ (install via [pnpm.io/installation](https://pnpm.io/installation))
- A running x402 server (you can use the example express server at `examples/server-example`)
- A valid Stellar secret key for making payments (get testnet XLM from [friendbot](https://laboratory.stellar.org/#account-creator?network=test))
- **Claude Desktop** with MCP support

## Setup

1. Install and build all packages from the repository root:

```bash
cd ../../
pnpm install
pnpm build
cd examples/mcp
```

2. Copy `.env-local` to `.env` and add your Stellar secret key:

```bash
cp .env-local .env
```

Edit `.env` and add:
```
STELLAR_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
RESOURCE_SERVER_URL=http://localhost:3000
ENDPOINT_PATH=/api/premium/content
MAX_AMOUNT_STROOPS=10000000  # optional, default 1 XLM
```

3. Configure Claude Desktop MCP settings:

```json
{
  "mcpServers": {
    "x402-stellar": {
      "command": "npx",
      "args": [
        "pnpm",
        "--silent",
        "-C",
        "<absolute path to this repo>/examples/mcp",
        "dev"
      ],
      "env": {
        "STELLAR_SECRET_KEY": "<secret key of a wallet with XLM on Stellar Testnet>",
        "RESOURCE_SERVER_URL": "http://localhost:3000",
        "ENDPOINT_PATH": "/api/premium/content",
        "MAX_AMOUNT_STROOPS": "10000000"
      }
    }
  }
}
```

4. Start the example client (remember to be running a server or pointing to one in the `.env` file):

```bash
pnpm dev
```

## How It Works

The example demonstrates how to:

- Create a Stellar keypair signer using `@stellar/stellar-sdk`
- Set up an MCP server with x402 payment handling
- Create a tool that makes paid API requests
- Handle responses and errors through the MCP protocol

## Example Code

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Keypair } from "@stellar/stellar-sdk";
import {
  createKeypairSigner,
  decodePaymentResponse,
  wrapFetchWithPayment,
} from "x402-stellar-fetch";

// Create Stellar signer
const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
const signer = createKeypairSigner(keypair);

// Wrap fetch to handle 402 and automatically pay
const fetchWithPay = wrapFetchWithPayment(fetch, signer, {
  maxAmount: BigInt(10_000_000), // 1 XLM
});

// Create MCP server
const server = new McpServer({
  name: "x402 MCP Stellar Client",
  version: "1.0.0",
});

// Add tool for making paid requests
server.tool(
  "get-data-from-resource-server",
  "Get data from the resource server (paid via x402 on Stellar)",
  {},
  async () => {
    const res = await fetchWithPay(
      new URL(ENDPOINT_PATH, RESOURCE_SERVER_URL).toString()
    );
    const paymentInfo = decodePaymentResponse(res);
    const data = await res.json();

    const content = [
      { type: "text" as const, text: JSON.stringify(data) },
      paymentInfo
        ? {
            type: "text" as const,
            text: `Payment tx: ${paymentInfo.transaction} on ${paymentInfo.network} | payer: ${paymentInfo.payer}`,
          }
        : { type: "text" as const, text: "Payment info unavailable" },
    ];

    return { content };
  }
);

// Connect to MCP transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Response Handling

### Payment Required (402)

When a payment is required, the MCP server will:

1. Receive the 402 response
2. Parse the payment requirements
3. Create and sign a payment header
4. Automatically retry the request with the payment header

### Successful Response

After payment is processed, the MCP server will return the response data through the MCP protocol:

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"premium\":\"content\",\"data\":\"value\"}"
    },
    {
      "type": "text",
      "text": "Payment tx: abc123... on stellar-testnet | payer: GXXXX..."
    }
  ]
}
```

## Extending the Example

To use this pattern in your own application:

1. Install the required dependencies:
```bash
npm install @modelcontextprotocol/sdk @stellar/stellar-sdk x402-stellar-fetch x402-stellar-client
```

2. Set up your environment variables
3. Create a Stellar signer (keypair or Freighter)
4. Set up your MCP server with x402 payment handling
5. Define your tools for making paid requests
6. Connect to the MCP transport

## Integration with Claude Desktop

This example is designed to work with Claude Desktop's MCP support. The MCP server will:

- Listen for tool requests from Claude
- Handle the payment process automatically
- Return the response data through the MCP protocol
- Allow Claude to process and display the results
