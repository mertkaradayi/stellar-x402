import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Keypair } from "@stellar/stellar-sdk";
import { config } from "dotenv";
import {
  createKeypairSigner,
  decodePaymentResponse,
  wrapFetchWithPayment,
} from "x402-stellar-fetch";

config();

const secret = process.env.STELLAR_SECRET_KEY;
const baseURL = process.env.RESOURCE_SERVER_URL; // e.g. https://example.com
const endpointPath = process.env.ENDPOINT_PATH; // e.g. /weather
const maxAmount =
  process.env.MAX_AMOUNT_STROOPS !== undefined
    ? BigInt(process.env.MAX_AMOUNT_STROOPS)
    : BigInt(10_000_000); // default 1 XLM

if (!secret || !baseURL || !endpointPath) {
  throw new Error("Missing STELLAR_SECRET_KEY, RESOURCE_SERVER_URL, or ENDPOINT_PATH");
}

// Create Stellar signer (backend keypair)
const signer = createKeypairSigner(Keypair.fromSecret(secret));

// Wrap fetch to handle 402 and automatically pay
const fetchWithPay = wrapFetchWithPayment(fetch, signer, { maxAmount });

// Create MCP server
const server = new McpServer({
  name: "x402 MCP Stellar Client",
  version: "1.0.0",
});

// Tool: fetch paid data from resource server
server.tool(
  "get-data-from-resource-server",
  "Get data from the resource server (paid via x402 on Stellar)",
  {},
  async () => {
    const res = await fetchWithPay(new URL(endpointPath, baseURL).toString());
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
  },
);

// Connect transport
const transport = new StdioServerTransport();
await server.connect(transport);
