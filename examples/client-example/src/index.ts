/**
 * Example client that pays for APIs with x402
 *
 * This demonstrates how to use x402-stellar-fetch to automatically
 * handle 402 Payment Required responses.
 *
 * Run with: pnpm start
 */

import { Keypair } from "@stellar/stellar-sdk";
import { wrapFetchWithPayment, createKeypairSigner } from "x402-stellar-fetch";

// Your Stellar secret key (NEVER commit this to source control!)
// Generate a new one with: Keypair.random().secret()
// Fund it on testnet: https://friendbot.stellar.org
const SECRET_KEY = process.env.STELLAR_SECRET_KEY || "SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

async function main() {
  console.log("🚀 x402 Client Example\n");

  // Create a signer from your keypair
  let keypair: Keypair;
  try {
    keypair = Keypair.fromSecret(SECRET_KEY);
  } catch {
    console.error("❌ Invalid secret key!");
    console.log("\nTo get started:");
    console.log("1. Generate a new keypair:");
    console.log("   node -e \"const { Keypair } = require('@stellar/stellar-sdk'); const kp = Keypair.random(); console.log('Public:', kp.publicKey()); console.log('Secret:', kp.secret());\"");
    console.log("\n2. Fund it on testnet:");
    console.log("   curl 'https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY'");
    console.log("\n3. Set the secret key:");
    console.log("   STELLAR_SECRET_KEY=SXXX... pnpm start");
    return;
  }

  const signer = createKeypairSigner(keypair);
  console.log(`💳 Using account: ${keypair.publicKey()}\n`);

  // Wrap fetch to automatically handle 402 responses
  const fetchWithPay = wrapFetchWithPayment(fetch, signer, {
    maxAmount: BigInt(20_000_000), // Max 2 XLM per request
  });

  // Try to access a protected endpoint
  const SERVER_URL = "http://localhost:3000";

  console.log("📡 Making request to protected endpoint...\n");

  try {
    const response = await fetchWithPay(`${SERVER_URL}/api/premium/content`);

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Success! Received data:");
      console.log(JSON.stringify(data, null, 2));

      // Check for payment response header
      const paymentResponse = response.headers.get("X-PAYMENT-RESPONSE");
      if (paymentResponse) {
        console.log("\n💰 Payment details:");
        console.log(Buffer.from(paymentResponse, "base64").toString());
      }
    } else {
      console.log(`❌ Request failed: ${response.status} ${response.statusText}`);
      const body = await response.text();
      console.log(body);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.log(`❌ Error: ${error.message}`);

      if (error.message.includes("ECONNREFUSED")) {
        console.log("\n💡 Make sure the server is running:");
        console.log("   cd ../server-example && pnpm start");
      }
    }
  }
}

main().catch(console.error);

