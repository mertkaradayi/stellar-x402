/**
 * Example Express server protected with x402 payments
 *
 * Run with: pnpm start
 * 
 * Environment variables:
 * - PORT: Server port (default: 3000)
 * - FACILITATOR_URL: URL of the x402 facilitator (default: http://localhost:4022)
 * - STELLAR_ADDRESS: Stellar address to receive payments (required for production)
 */

import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { paymentMiddleware } from "x402-stellar-express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (for test pages)
app.use('/public', express.static(path.join(__dirname, '../public')));

// Stellar address to receive payments (from env or default for testing)
const PAY_TO = process.env.STELLAR_ADDRESS || "GC63PSERYMUUUJKYSSFQ7FKRAU5UPIP3XUC6X7DLMZUB7SSCPW5BSIRT";

// Facilitator URL (from env or default for local development)
const FACILITATOR_URL = process.env.FACILITATOR_URL || "http://localhost:4022";

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
      url: FACILITATOR_URL,
    },
    // Use testnet for development
    network: "stellar-testnet",
    // Optional: Enable browser-friendly paywall UI
    paywall: {
      appName: "Example API",
      debug: process.env.NODE_ENV !== "production", // Disable debug in production
    },
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
  // Serve a simple HTML page for browser testing
  if (req.get("Accept")?.includes("text/html")) {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stellar x402 Example</title>
  <style>
    :root {
      --bg-dark: #ffffff;
      --bg-card: #f8f9fa;
      --text-primary: #111111;
      --text-secondary: #555555;
      --border-color: #e2e8f0;
      --accent-color: #111111;
      --dither-color: #e5e5e5;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background-color: var(--bg-dark);
      background-image: radial-gradient(var(--dither-color) 1px, transparent 1px);
      background-size: 4px 4px;
      color: var(--text-primary);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      max-width: 600px;
      width: 100%;
      background: var(--bg-dark);
      border: 1px solid var(--border-color);
      padding: 40px;
      position: relative;
      box-shadow: 8px 8px 0px var(--border-color);
      border-radius: 4px;
    }

    h1 {
      font-size: 24px;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 16px;
    }

    p { 
      margin-bottom: 32px; 
      color: var(--text-secondary); 
      line-height: 1.6; 
      font-size: 14px;
    }

    .endpoints {
      border: 1px solid var(--border-color);
      padding: 24px;
      margin-bottom: 24px;
      background: var(--bg-card);
      border-radius: 4px;
    }

    .endpoints h2 {
      font-size: 13px;
      margin-bottom: 16px;
      color: var(--text-secondary);
      text-transform: uppercase;
      font-weight: 600;
    }

    .endpoint {
      padding: 12px;
      margin-bottom: 8px;
      border: 1px dotted var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      background: var(--bg-dark);
      border-radius: 4px;
    }

    .endpoint:last-child {
      margin-bottom: 0;
    }

    .endpoint a {
      color: var(--text-primary);
      text-decoration: none;
      font-weight: 700;
      text-transform: uppercase;
    }

    .endpoint a:hover {
      text-decoration: underline;
      background: var(--text-primary);
      color: var(--bg-dark);
    }

    .price {
      color: var(--text-primary);
      font-weight: 700;
    }

    .free-badge {
      color: var(--text-secondary);
      text-transform: uppercase;
      font-size: 12px;
      font-weight: 600;
    }

    .note {
      border: 1px solid var(--border-color);
      padding: 16px;
      margin-top: 32px;
      font-size: 13px;
      color: var(--text-secondary);
      border-radius: 4px;
      background: var(--bg-card);
    }

    .note strong { 
      color: var(--text-primary); 
      text-transform: uppercase;
      display: block;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Stellar x402 Example</h1>
    <p>System Online. Secure Payment Gateway Active.</p>
    
    <div class="endpoints">
      <h2>Public Access</h2>
      <div class="endpoint">
        <a href="/">[ Home ]</a>
        <span class="free-badge">Free</span>
      </div>
      <div class="endpoint">
        <a href="/health">[ Health Check ]</a>
        <span class="free-badge">Free</span>
      </div>
    </div>

    <div class="endpoints">
      <h2>Restricted Access</h2>
      <div class="endpoint">
        <a href="/api/premium/content">[ Premium Content ]</a>
        <span class="price">1 XLM</span>
      </div>
      <div class="endpoint">
        <a href="/api/premium/stats">[ Premium Stats ]</a>
        <span class="price">1 XLM</span>
      </div>
      <div class="endpoint">
        <a href="/api/data">[ Data API ]</a>
        <span class="price">0.5 XLM</span>
      </div>
    </div>

    <div class="note">
      <strong>>> System Instructions</strong>
      1. Select a restricted endpoint above<br>
      2. Authenticate via Freighter Wallet<br>
      3. Authorize transaction<br>
      4. Access granted
    </div>
  </div>
</body>
</html>
    `);
  } else {
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
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`💰 Payments go to: ${PAY_TO}`);
  console.log(`📡 Facilitator: ${FACILITATOR_URL}`);
  console.log("");
  console.log("Protected endpoints:");
  console.log("  GET /api/premium/* - 1 XLM");
  console.log("  GET /api/data - 0.5 XLM");
});

