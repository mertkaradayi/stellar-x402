/**
 * Base64 encoding/decoding utilities
 */

/**
 * Safely decode a base64 string
 */
export function safeBase64Decode(str: string): string {
  try {
    // Handle browser and Node.js environments
    if (typeof Buffer !== "undefined") {
      return Buffer.from(str, "base64").toString("utf-8");
    }
    return atob(str);
  } catch {
    throw new Error("Invalid base64 string");
  }
}

/**
 * Safely encode a string to base64
 */
export function safeBase64Encode(str: string): string {
  // Handle browser and Node.js environments
  if (typeof Buffer !== "undefined") {
    return Buffer.from(str, "utf-8").toString("base64");
  }
  return btoa(str);
}

/**
 * Encode an object to a base64 JSON string
 */
export function encodePaymentHeader(payload: unknown): string {
  return safeBase64Encode(JSON.stringify(payload));
}

/**
 * Decode a base64 JSON string to an object
 */
export function decodePaymentHeader<T>(header: string): T {
  const decoded = safeBase64Decode(header);
  return JSON.parse(decoded) as T;
}

