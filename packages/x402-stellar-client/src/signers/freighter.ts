/**
 * Freighter Signer
 *
 * Signs Stellar transactions using the Freighter browser wallet
 */

/**
 * Check if Freighter is installed and connected
 */
export async function isFreighterConnected(): Promise<boolean> {
  try {
    const freighterApi = await import("@stellar/freighter-api");
    const { isConnected } = freighterApi;
    return await isConnected();
  } catch {
    return false;
  }
}

/**
 * Get the public key from Freighter
 *
 * @returns The user's public key
 * @throws If Freighter is not installed or user denies access
 */
export async function getFreighterPublicKey(): Promise<string> {
  const freighterApi = await import("@stellar/freighter-api");
  const { requestAccess, getAddress } = freighterApi;

  // Request access if not already granted
  const accessResult = await requestAccess();
  if (accessResult.error) {
    throw new Error(`Freighter access denied: ${accessResult.error}`);
  }

  // Get the address
  const addressResult = await getAddress();
  if (addressResult.error) {
    throw new Error(`Failed to get Freighter address: ${addressResult.error}`);
  }

  return addressResult.address;
}

/**
 * Sign a transaction XDR using Freighter
 *
 * @param unsignedTxXdr - The unsigned transaction XDR (base64)
 * @param networkPassphrase - The network passphrase
 * @returns The signed transaction XDR (base64)
 * @throws If Freighter is not installed or user denies signing
 */
export async function signWithFreighter(
  unsignedTxXdr: string,
  networkPassphrase: string
): Promise<string> {
  const freighterApi = await import("@stellar/freighter-api");
  const { signTransaction } = freighterApi;

  const result = await signTransaction(unsignedTxXdr, {
    networkPassphrase,
  });

  if (result.error) {
    throw new Error(`Freighter signing failed: ${result.error}`);
  }

  return result.signedTxXdr;
}

/**
 * Get the network from Freighter settings
 */
export async function getFreighterNetwork(): Promise<string> {
  const freighterApi = await import("@stellar/freighter-api");
  const { getNetwork } = freighterApi;

  const result = await getNetwork();
  if (result.error) {
    throw new Error(`Failed to get Freighter network: ${result.error}`);
  }

  return result.network;
}

