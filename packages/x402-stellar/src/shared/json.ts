/**
 * JSON utilities for safe serialization
 */

/**
 * Convert BigInt values to strings for JSON serialization
 */
export function toJsonSafe<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;
}

