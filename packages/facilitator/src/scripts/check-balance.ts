import * as Stellar from "@stellar/stellar-sdk";

const NETWORK = "testnet";
const HORIZON_URL = "https://horizon-testnet.stellar.org";

async function main() {
  const publicKey = process.env.STELLAR_PUBLIC_KEY || process.argv[2];

  if (!publicKey) {
    // Generate a new keypair for testing
    const keypair = Stellar.Keypair.random();
    console.log("No public key provided. Generated new keypair:");
    console.log(`  Public Key:  ${keypair.publicKey()}`);
    console.log(`  Secret Key:  ${keypair.secret()}`);
    console.log(`\nFund it with Friendbot:`);
    console.log(`  curl "https://friendbot.stellar.org?addr=${keypair.publicKey()}"`);
    return;
  }

  const server = new Stellar.Horizon.Server(HORIZON_URL);

  try {
    const account = await server.loadAccount(publicKey);
    console.log(`Account: ${publicKey}`);
    console.log(`Network: ${NETWORK}`);
    console.log(`\nBalances:`);

    for (const balance of account.balances) {
      if (balance.asset_type === "native") {
        console.log(`  XLM: ${balance.balance}`);
      } else if ("asset_code" in balance) {
        console.log(`  ${balance.asset_code}: ${balance.balance}`);
      }
    }

    console.log(`\nView on explorer: https://stellar.expert/explorer/${NETWORK}/account/${publicKey}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Not Found")) {
      console.log(`Account ${publicKey} not found on ${NETWORK}.`);
      console.log(`\nFund it with Friendbot:`);
      console.log(`  curl "https://friendbot.stellar.org?addr=${publicKey}"`);
    } else {
      throw error;
    }
  }
}

main().catch(console.error);



