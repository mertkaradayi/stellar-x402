/**
 * Integration Tests: /supported Endpoint
 * 
 * Per x402 spec, response must be:
 * { kinds: [{ scheme: string, network: string }] }
 */

import request from "supertest";
import { createTestApp, TEST_NETWORK } from "./helpers.js";
import type { Express } from "express";

describe("/supported Endpoint", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  describe("Response Format (x402 Spec Compliance)", () => {
    it("should return { kinds: [...] } structure", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      expect(response.body).toHaveProperty("kinds");
      expect(Array.isArray(response.body.kinds)).toBe(true);
    });

    it("should return kinds as array of { x402Version, scheme, network } objects per spec", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      for (const kind of response.body.kinds) {
        expect(kind).toHaveProperty("x402Version");
        expect(kind).toHaveProperty("scheme");
        expect(kind).toHaveProperty("network");
        expect(typeof kind.x402Version).toBe("number");
        expect(typeof kind.scheme).toBe("string");
        expect(typeof kind.network).toBe("string");
      }
    });

    it("should include x402Version = 1 in each kind object", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      for (const kind of response.body.kinds) {
        expect(kind.x402Version).toBe(1);
      }
    });

    it("should include x402Version, scheme, network, and extra fields in kind objects", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      for (const kind of response.body.kinds) {
        const keys = Object.keys(kind);
        expect(keys).toHaveLength(4);
        expect(keys).toContain("x402Version");
        expect(keys).toContain("scheme");
        expect(keys).toContain("network");
        expect(keys).toContain("extra");
      }
    });
  });

  describe("Supported Combinations", () => {
    it("should include stellar-testnet with exact scheme", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      const stellarTestnet = response.body.kinds.find(
        (k: { scheme: string; network: string }) => 
          k.scheme === "exact" && k.network === "stellar-testnet"
      );

      expect(stellarTestnet).toBeDefined();
    });

    it("should return at least one supported combination", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      expect(response.body.kinds.length).toBeGreaterThan(0);
    });
  });

  describe("HTTP Method", () => {
    it("should respond to GET requests", async () => {
      await request(app)
        .get("/supported")
        .expect(200);
    });

    it("should return JSON content type", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      expect(response.headers["content-type"]).toMatch(/application\/json/);
    });
  });

  describe("Consistency", () => {
    it("should return same response on multiple calls", async () => {
      const response1 = await request(app).get("/supported").expect(200);
      const response2 = await request(app).get("/supported").expect(200);

      expect(response1.body).toEqual(response2.body);
    });
  });
});

describe("/health Endpoint", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  it("should return { status: 'ok', service: '...' }", async () => {
    const response = await request(app)
      .get("/health")
      .expect(200);

    expect(response.body).toHaveProperty("status", "ok");
    expect(response.body).toHaveProperty("service");
    expect(typeof response.body.service).toBe("string");
  });

  it("should respond to GET requests", async () => {
    await request(app)
      .get("/health")
      .expect(200);
  });
});

