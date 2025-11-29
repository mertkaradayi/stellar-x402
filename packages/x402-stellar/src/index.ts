/**
 * x402-stellar - Core library for Stellar x402 payment protocol
 *
 * This package provides:
 * - Zod schemas for validating x402 payloads
 * - TypeScript types for all x402 structures
 * - Facilitator client (useFacilitator) for calling facilitator endpoints
 * - Shared utilities for base64 encoding and JSON handling
 */

// Types and schemas
export * from "./types/index.js";

// Shared utilities
export * from "./shared/index.js";

// Facilitator client
export * from "./verify/index.js";

