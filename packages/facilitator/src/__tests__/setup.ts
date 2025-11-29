/**
 * Jest Test Setup
 *
 * This file runs before each test file.
 */

import { jest } from "@jest/globals";

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console logs during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn() as unknown as typeof console.log,
    info: jest.fn() as unknown as typeof console.info,
    warn: jest.fn() as unknown as typeof console.warn,
    // Keep error for debugging failed tests
    error: console.error,
  };
}
