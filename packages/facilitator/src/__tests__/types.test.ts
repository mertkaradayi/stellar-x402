/**
 * Unit Tests: Payment Header Validation
 * 
 * Tests decodeAndValidatePaymentHeader() function for x402 spec compliance:
 * - Valid base64 + valid JSON + valid fields -> success
 * - Invalid base64 -> error
 * - Invalid JSON -> error
 * - Missing x402Version -> error
 * - Wrong x402Version (not 1) -> error
 * - Missing scheme, network, payload -> errors
 * - Unsupported (scheme, network) combination -> error
 */

import { decodeAndValidatePaymentHeader } from "../types/index.js";
import { 
  createPaymentPayload, 
  createStellarPayload, 
  encodePaymentHeader 
} from "./helpers.js";

describe("decodeAndValidatePaymentHeader()", () => {
  describe("Valid Inputs", () => {
    it("should accept valid base64 + valid JSON + valid fields", () => {
      const stellarPayload = createStellarPayload();
      const paymentPayload = createPaymentPayload(stellarPayload);
      const paymentHeader = encodePaymentHeader(paymentPayload);

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.x402Version).toBe(1);
        expect(result.payload.scheme).toBe("exact");
        expect(result.payload.network).toBe("stellar-testnet");
        expect(result.payload.payload).toBeDefined();
      }
    });

    it("should preserve all payload fields", () => {
      const stellarPayload = createStellarPayload({
        sourceAccount: "GABCDEFGHIJKLMNOP",
        amount: "5000000",
        destination: "GXYZ123456789",
        nonce: "unique-nonce-123",
      });
      const paymentPayload = createPaymentPayload(stellarPayload);
      const paymentHeader = encodePaymentHeader(paymentPayload);

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.payload.sourceAccount).toBe("GABCDEFGHIJKLMNOP");
        expect(result.payload.payload.amount).toBe("5000000");
        expect(result.payload.payload.destination).toBe("GXYZ123456789");
        expect(result.payload.payload.nonce).toBe("unique-nonce-123");
      }
    });
  });

  describe("Invalid Base64", () => {
    it("should reject invalid base64 encoding", () => {
      const invalidBase64 = "not-valid-base64!!!@@@";

      const result = decodeAndValidatePaymentHeader(invalidBase64);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBeTruthy(); // Error message varies by implementation
      }
    });

    it("should reject empty string", () => {
      const result = decodeAndValidatePaymentHeader("");

      expect(result.valid).toBe(false);
    });
  });

  describe("Invalid JSON", () => {
    it("should reject invalid JSON after base64 decode", () => {
      const invalidJson = Buffer.from("not valid json {{{").toString("base64");

      const result = decodeAndValidatePaymentHeader(invalidJson);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("JSON");
      }
    });

    it("should reject base64 encoded non-object JSON", () => {
      const arrayJson = Buffer.from(JSON.stringify([1, 2, 3])).toString("base64");

      const result = decodeAndValidatePaymentHeader(arrayJson);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBeTruthy(); // Error message varies - may fail on object check or missing fields
      }
    });

    it("should reject base64 encoded null", () => {
      const nullJson = Buffer.from("null").toString("base64");

      const result = decodeAndValidatePaymentHeader(nullJson);

      expect(result.valid).toBe(false);
    });

    it("should reject base64 encoded string", () => {
      const stringJson = Buffer.from('"just a string"').toString("base64");

      const result = decodeAndValidatePaymentHeader(stringJson);

      expect(result.valid).toBe(false);
    });
  });

  describe("Missing x402Version", () => {
    it("should reject payload without x402Version", () => {
      const payload = {
        scheme: "exact",
        network: "stellar-testnet",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("x402Version");
      }
    });
  });

  describe("Wrong x402Version", () => {
    it("should reject x402Version = 0", () => {
      const payload = {
        x402Version: 0,
        scheme: "exact",
        network: "stellar-testnet",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("x402Version");
      }
    });

    it("should reject x402Version = 2", () => {
      const payload = {
        x402Version: 2,
        scheme: "exact",
        network: "stellar-testnet",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("x402Version");
      }
    });

    it("should reject x402Version as string", () => {
      const payload = {
        x402Version: "1",
        scheme: "exact",
        network: "stellar-testnet",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
    });
  });

  describe("Missing scheme", () => {
    it("should reject payload without scheme", () => {
      const payload = {
        x402Version: 1,
        network: "stellar-testnet",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("scheme");
      }
    });

    it("should reject empty scheme", () => {
      const payload = {
        x402Version: 1,
        scheme: "",
        network: "stellar-testnet",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
    });

    it("should reject non-string scheme", () => {
      const payload = {
        x402Version: 1,
        scheme: 123,
        network: "stellar-testnet",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
    });
  });

  describe("Missing network", () => {
    it("should reject payload without network", () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("network");
      }
    });

    it("should reject empty network", () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
    });

    it("should reject non-string network", () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: 123,
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
    });
  });

  describe("Missing payload", () => {
    it("should reject payload without payload field", () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "stellar-testnet",
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("payload");
      }
    });

    it("should reject null payload", () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "stellar-testnet",
        payload: null,
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
    });

    it("should reject non-object payload", () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "stellar-testnet",
        payload: "string-payload",
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
    });
  });

  describe("Unsupported (scheme, network) combination", () => {
    it("should reject unsupported network", () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "ethereum-mainnet", // Not supported
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Unsupported");
      }
    });

    it("should reject unsupported scheme", () => {
      const payload = {
        x402Version: 1,
        scheme: "streaming", // Not supported
        network: "stellar-testnet",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Unsupported");
      }
    });

    it("should reject both unsupported scheme and network", () => {
      const payload = {
        x402Version: 1,
        scheme: "unknown-scheme",
        network: "unknown-network",
        payload: {},
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toContain("Unsupported");
      }
    });

    it("should accept supported combination: exact + stellar-testnet", () => {
      const stellarPayload = createStellarPayload();
      const paymentPayload = createPaymentPayload(stellarPayload, {
        scheme: "exact",
        network: "stellar-testnet",
      });
      const paymentHeader = encodePaymentHeader(paymentPayload);

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle extra fields gracefully", () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "stellar-testnet",
        payload: {},
        extraField: "should be ignored",
        anotherExtra: 123,
      };
      const paymentHeader = Buffer.from(JSON.stringify(payload)).toString("base64");

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(true);
    });

    it("should handle deeply nested payload", () => {
      const stellarPayload = createStellarPayload({
        signedTxXdr: "AAAA...very-long-xdr...AAAA",
      });
      const paymentPayload = createPaymentPayload(stellarPayload);
      const paymentHeader = encodePaymentHeader(paymentPayload);

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.payload.signedTxXdr).toBe("AAAA...very-long-xdr...AAAA");
      }
    });

    it("should handle unicode in payload", () => {
      const stellarPayload = createStellarPayload({
        nonce: "nonce-with-unicode-🚀-emoji",
      });
      const paymentPayload = createPaymentPayload(stellarPayload);
      const paymentHeader = encodePaymentHeader(paymentPayload);

      const result = decodeAndValidatePaymentHeader(paymentHeader);

      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.payload.payload.nonce).toBe("nonce-with-unicode-🚀-emoji");
      }
    });
  });
});

