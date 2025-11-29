/**
 * x402 Stellar Facilitator
 *
 * Express server that implements the x402 facilitator interface for Stellar.
 * Following Coinbase x402 pattern for folder structure and naming.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { verifyRoute } from "./routes/verify.js";
import { settleRoute } from "./routes/settle.js";
import { SUPPORTED_KINDS } from "./types/index.js";
import { connectRedis, disconnectRedis, testRedisConnection } from "./storage/redis.js";

const app = express();
const PORT = process.env.PORT || 4022;

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "x402-stellar-facilitator" });
});

// x402 /supported endpoint - declares supported (scheme, network) combinations
// Per x402 spec: each kind must include x402Version, scheme, network, and optional extra
app.get("/supported", (_req, res) => {
  res.json({
    kinds: SUPPORTED_KINDS.map((k) => ({
      x402Version: k.x402Version,
      scheme: k.scheme,
      network: k.network,
      // Extra field for Stellar-specific metadata (like SVM uses feePayer)
      extra: {
        // Indicates if the facilitator can sponsor transaction fees
        feeSponsorship: !!process.env.FACILITATOR_SECRET_KEY,
      },
    })),
  });
});

// x402 facilitator endpoints
app.post("/verify", verifyRoute);
app.post("/settle", settleRoute);

// Initialize Redis connection on startup
async function startServer() {
  // Connect to Redis
  await connectRedis();

  // Test Redis connection
  await testRedisConnection();

  // Start Express server
  app.listen(PORT, () => {
    console.log(`🚀 x402 Stellar Facilitator running on http://localhost:${PORT}`);
    console.log(`   GET  /supported - List supported schemes/networks`);
    console.log(`   POST /verify    - Verify payment`);
    console.log(`   POST /settle    - Settle payment`);
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[shutdown] Received SIGINT, shutting down gracefully...");
  await disconnectRedis();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[shutdown] Received SIGTERM, shutting down gracefully...");
  await disconnectRedis();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error("[startup] Failed to start server:", error);
  process.exit(1);
});
