# Railway Deployment Guide

This guide explains how to deploy the Stellar x402 ecosystem to Railway.

## Overview

The deployment consists of two services:
1. **Facilitator** - Payment verification and settlement service
2. **Example Server** - Demo API with payment protection

## Prerequisites

- Railway account and CLI installed (`railway login` completed)
- GitHub repository with this code
- Redis instance (Railway Redis or external like Redis Cloud)

## Quick Start

### Step 1: Create a New Project in Railway

```bash
# Navigate to the project root
cd stellar-x402

# Create a new Railway project (if not already created)
railway init
```

Or create via Railway dashboard at https://railway.app/new

### Step 2: Deploy the Facilitator Service

1. **In Railway Dashboard:**
   - Click "New Service" → "GitHub Repo"
   - Select your `stellar-x402` repository
   - **IMPORTANT:** Set the Root Directory to `packages/facilitator`

2. **Configure Build Settings:**
   - Build Command: `cd ../.. && pnpm install && pnpm build`
   - Start Command: `node dist/index.js`
   - Watch Paths: `packages/facilitator/**`

3. **Add Environment Variables:**
   ```
   PORT=4022
   STELLAR_NETWORK=testnet
   REDIS_URL=redis://admin:YOUR_PASSWORD@YOUR_REDIS_HOST:YOUR_PORT
   ASSET_CONTRACT=native
   ```

   **For your Redis Cloud instance:**
   ```
   REDIS_URL=redis://admin:2186918Mert.k@redis-14797.crce198.eu-central-1-3.ec2.cloud.redislabs.com:14797
   ```

4. **Optional - Fee Sponsorship:**
   If you want the facilitator to sponsor transaction fees:
   ```
   FACILITATOR_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

5. **Deploy:**
   Click "Deploy" and wait for the build to complete.

6. **Generate Domain:**
   - Go to Settings → Networking → Generate Domain
   - Note the URL (e.g., `facilitator-production-xxxx.up.railway.app`)

### Step 3: Deploy the Example Server

1. **In Railway Dashboard:**
   - Click "New Service" → "GitHub Repo"
   - Select your `stellar-x402` repository (same repo)
   - **IMPORTANT:** Set the Root Directory to `examples/server-example`

2. **Configure Build Settings:**
   - Build Command: `cd ../.. && pnpm install && pnpm build`
   - Start Command: `npx tsx src/index.ts`
   - Watch Paths: `examples/server-example/**`

3. **Add Environment Variables:**
   ```
   PORT=3000
   FACILITATOR_URL=https://YOUR_FACILITATOR_URL.up.railway.app
   STELLAR_ADDRESS=YOUR_STELLAR_ADDRESS_TO_RECEIVE_PAYMENTS
   NODE_ENV=production
   ```

   Example:
   ```
   FACILITATOR_URL=https://facilitator-production-xxxx.up.railway.app
   STELLAR_ADDRESS=GC63PSERYMUUUJKYSSFQ7FKRAU5UPIP3XUC6X7DLMZUB7SSCPW5BSIRT
   ```

4. **Deploy:**
   Click "Deploy" and wait for the build to complete.

5. **Generate Domain:**
   - Go to Settings → Networking → Generate Domain
   - Your example server is now live!

## Alternative: CLI Deployment

### Using Railway CLI

```bash
# Link to existing project
railway link

# Deploy facilitator
cd packages/facilitator
railway up --service facilitator

# Deploy example server
cd ../../examples/server-example
railway up --service example-server
```

## Environment Variables Reference

### Facilitator Service

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | `4022` |
| `STELLAR_NETWORK` | No | `testnet` or `mainnet` | `testnet` |
| `REDIS_URL` | **Yes** | Redis connection URL | - |
| `ASSET_CONTRACT` | No | Asset to accept | `native` |
| `FACILITATOR_SECRET_KEY` | No | For fee sponsorship | - |

### Example Server

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `PORT` | No | Server port | `3000` |
| `FACILITATOR_URL` | **Yes** | Facilitator service URL | `http://localhost:4022` |
| `STELLAR_ADDRESS` | **Yes** | Your Stellar address | Test address |
| `NODE_ENV` | No | Environment | `development` |

## Verifying Deployment

### Check Facilitator Health

```bash
curl https://YOUR_FACILITATOR_URL.up.railway.app/health
# Should return: {"status":"ok","service":"x402-stellar-facilitator"}
```

### Check Supported Networks

```bash
curl https://YOUR_FACILITATOR_URL.up.railway.app/supported
# Should return supported schemes and networks
```

### Check Example Server

```bash
curl https://YOUR_SERVER_URL.up.railway.app/health
# Should return: {"status":"ok"}

# Try a protected endpoint (will return 402 Payment Required)
curl https://YOUR_SERVER_URL.up.railway.app/api/premium/content
```

## Troubleshooting

### Build Fails

1. Ensure you're using Node.js 18+ (Railway auto-detects)
2. Check that pnpm is being used (specified in `package.json`)
3. Verify the root directory is set correctly for each service

### Redis Connection Issues

1. Check REDIS_URL format: `redis://username:password@host:port`
2. Ensure Redis instance allows connections from Railway's IPs
3. For Redis Cloud, enable "Public Endpoint" in settings

### Facilitator Not Responding

1. Check logs in Railway dashboard
2. Verify PORT is not hardcoded (Railway sets PORT automatically)
3. Ensure REDIS_URL is correctly configured

### Service Communication Issues

1. Ensure FACILITATOR_URL uses HTTPS (Railway domains)
2. Check that both services are in the same Railway project
3. Verify there are no typos in the environment variables

## Production Checklist

- [ ] STELLAR_NETWORK set to `mainnet` for production
- [ ] FACILITATOR_SECRET_KEY set if using fee sponsorship
- [ ] REDIS_URL pointing to production Redis instance
- [ ] Custom domain configured (optional)
- [ ] SSL/TLS enabled (automatic on Railway)
- [ ] Health checks passing
- [ ] Logs monitored for errors

## Cost Considerations

Railway pricing:
- Hobby plan: Free $5/month credit
- Pro plan: $20/month base + usage

Redis Cloud:
- Free tier: 30MB, suitable for testing
- Paid tiers for production

## Support

- Railway docs: https://docs.railway.app
- Stellar docs: https://developers.stellar.org
- x402 spec: https://github.com/coinbase/x402

