/**
 * Verify Redis Connection from .env
 * 
 * This script verifies that:
 * 1. .env file is being loaded
 * 2. REDIS_URL is set correctly
 * 3. Connection to Redis works
 * 4. Can perform basic operations (SET/GET)
 */

import "dotenv/config";
import { connectRedis, getRedisClient, testRedisConnection, disconnectRedis } from "../storage/redis.js";

async function main() {
  console.log("🔍 Verifying Redis connection from .env file...\n");

  // Check if REDIS_URL is set
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error("❌ REDIS_URL is not set in .env file!");
    process.exit(1);
  }

  // Mask password in URL for display
  const maskedUrl = redisUrl.replace(/:([^:@]+)@/, ":****@");
  console.log(`✅ REDIS_URL found: ${maskedUrl}\n`);

  try {
    // Connect to Redis
    console.log("📡 Connecting to Redis...");
    await connectRedis();

    // Test connection
    console.log("🧪 Testing connection (PING)...");
    const pingSuccess = await testRedisConnection();
    if (!pingSuccess) {
      console.error("❌ Connection test failed!");
      process.exit(1);
    }

    // Test basic operations
    console.log("🧪 Testing SET/GET operations...");
    const client = getRedisClient();
    if (!client || !client.isOpen) {
      console.error("❌ Redis client is not connected!");
      process.exit(1);
    }

    const testKey = "x402:test:connection";
    const testValue = `test-${Date.now()}`;

    // SET operation
    await client.set(testKey, testValue, { EX: 10 }); // Expires in 10 seconds
    console.log(`   ✅ SET ${testKey} = ${testValue}`);

    // GET operation
    const retrieved = await client.get(testKey);
    if (retrieved === testValue) {
      console.log(`   ✅ GET ${testKey} = ${retrieved}`);
    } else {
      console.error(`   ❌ GET failed: expected ${testValue}, got ${retrieved}`);
      process.exit(1);
    }

    // Clean up
    await client.del(testKey);
    console.log(`   ✅ DEL ${testKey} (cleanup)`);

    console.log("\n✅ All Redis operations successful!");
    console.log("✅ Redis connection is solid and working correctly!\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error during Redis verification:", error);
    process.exit(1);
  } finally {
    await disconnectRedis();
  }
}

main();


