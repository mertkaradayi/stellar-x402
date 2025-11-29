/**
 * Example Express server protected with x402 payments
 *
 * Run with: pnpm start
 */

import express from "express";
import { paymentMiddleware } from "x402-stellar-express";

const app = express();
const PORT = 3000;

// Your Stellar address to receive payments
// Replace with your actual address!
const PAY_TO = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

// Add x402 payment middleware
app.use(
  paymentMiddleware({
    payTo: PAY_TO,
    routes: {
      // Protect /api/premium/* routes - costs 1 XLM
      "/api/premium/*": {
        price: "1.00",
        description: "Premium API access",
      },
      // Protect /api/data route - costs 0.5 XLM
      "/api/data": {
        price: "0.50",
        description: "Access to data endpoint",
      },
    },
    // Point to your facilitator (run locally or use hosted)
    facilitator: {
      url: "http://localhost:4022",
    },
    // Use testnet for development
    network: "stellar-testnet",
  })
);

// Protected routes
app.get("/api/premium/content", (req, res) => {
  res.json({
    message: "🎉 You paid for premium content!",
    data: {
      secret: "This is premium data",
      timestamp: new Date().toISOString(),
    },
  });
});

app.get("/api/premium/stats", (req, res) => {
  res.json({
    message: "Premium statistics",
    stats: {
      users: 1234,
      revenue: 5678,
    },
  });
});

app.get("/api/data", (req, res) => {
  res.json({
    message: "You paid for data access!",
    data: [1, 2, 3, 4, 5],
  });
});

// Free routes (no payment required)
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the x402 example server!",
    endpoints: {
      free: ["GET /", "GET /health"],
      paid: [
        "GET /api/premium/content (1 XLM)",
        "GET /api/premium/stats (1 XLM)",
        "GET /api/data (0.5 XLM)",
      ],
    },
  });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`💰 Payments go to: ${PAY_TO}`);
  console.log(`📡 Facilitator: http://localhost:4022`);
  console.log("");
  console.log("Protected endpoints:");
  console.log("  GET /api/premium/* - 1 XLM");
  console.log("  GET /api/data - 0.5 XLM");
});

