/**
 * Facilitator Client
 *
 * HTTP client for interacting with a Stellar x402 facilitator service.
 * Following Coinbase's useFacilitator pattern.
 */

import { toJsonSafe } from "../shared/json.js";
import type {
  FacilitatorConfig,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
  SupportedPaymentKindsResponse,
  ListDiscoveryResourcesRequest,
  ListDiscoveryResourcesResponse,
} from "../types/facilitator.js";

const DEFAULT_FACILITATOR_URL = "https://facilitator.stellar-x402.org";

/**
 * Creates a facilitator client for interacting with the Stellar x402 payment facilitator service
 *
 * @param facilitator - Optional facilitator config. If not provided, uses default facilitator.
 * @returns An object containing verify, settle, and supported functions
 *
 * @example
 * ```typescript
 * const { verify, settle, supported } = useFacilitator({
 *   url: "http://localhost:4022"
 * });
 *
 * // Verify a payment
 * const verifyResult = await verify(paymentPayload, paymentRequirements);
 *
 * // Settle a payment
 * const settleResult = await settle(paymentPayload, paymentRequirements);
 *
 * // Get supported payment kinds
 * const supportedKinds = await supported();
 * ```
 */
export function useFacilitator(facilitator?: FacilitatorConfig) {
  /**
   * Verifies a payment payload with the facilitator service
   *
   * @param payload - The payment payload to verify
   * @param paymentRequirements - The payment requirements to verify against
   * @returns A promise that resolves to the verification response
   */
  async function verify(
    payload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    const url = facilitator?.url || DEFAULT_FACILITATOR_URL;

    let headers: Record<string, string> = { "Content-Type": "application/json" };
    if (facilitator?.createAuthHeaders) {
      const authHeaders = await facilitator.createAuthHeaders();
      headers = { ...headers, ...authHeaders.verify };
    }

    const res = await fetch(`${url}/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        x402Version: payload.x402Version,
        paymentPayload: toJsonSafe(payload),
        paymentRequirements: toJsonSafe(paymentRequirements),
      }),
    });

    if (res.status !== 200) {
      let errorMessage = `Failed to verify payment: ${res.statusText}`;
      try {
        const errorData = (await res.json()) as { error?: string };
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // JSON parsing failed, use default error message
      }
      throw new Error(errorMessage);
    }

    const data = await res.json();
    return data as VerifyResponse;
  }

  /**
   * Settles a payment with the facilitator service
   *
   * @param payload - The payment payload to settle
   * @param paymentRequirements - The payment requirements for the settlement
   * @returns A promise that resolves to the settlement response
   */
  async function settle(
    payload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const url = facilitator?.url || DEFAULT_FACILITATOR_URL;

    let headers: Record<string, string> = { "Content-Type": "application/json" };
    if (facilitator?.createAuthHeaders) {
      const authHeaders = await facilitator.createAuthHeaders();
      headers = { ...headers, ...authHeaders.settle };
    }

    const res = await fetch(`${url}/settle`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        x402Version: payload.x402Version,
        paymentPayload: toJsonSafe(payload),
        paymentRequirements: toJsonSafe(paymentRequirements),
      }),
    });

    if (res.status !== 200) {
      let errorMessage = `Failed to settle payment: ${res.status} ${res.statusText}`;
      try {
        const errorData = (await res.json()) as { error?: string };
        if (errorData.error) {
          errorMessage = errorData.error;
        }
      } catch {
        // JSON parsing failed, use default error message
      }
      throw new Error(errorMessage);
    }

    const data = await res.json();
    return data as SettleResponse;
  }

  /**
   * Gets the supported payment kinds from the facilitator service
   *
   * @returns A promise that resolves to the supported payment kinds
   */
  async function supported(): Promise<SupportedPaymentKindsResponse> {
    const url = facilitator?.url || DEFAULT_FACILITATOR_URL;

    let headers: Record<string, string> = { "Content-Type": "application/json" };
    if (facilitator?.createAuthHeaders) {
      const authHeaders = await facilitator.createAuthHeaders();
      headers = { ...headers, ...authHeaders.supported };
    }

    const res = await fetch(`${url}/supported`, {
      method: "GET",
      headers,
    });

    if (res.status !== 200) {
      throw new Error(`Failed to get supported payment kinds: ${res.statusText}`);
    }

    const data = await res.json();
    return data as SupportedPaymentKindsResponse;
  }

  /**
   * Lists discovery resources from the facilitator service
   *
   * @param config - Optional parameters for filtering and pagination
   * @returns A promise that resolves to the discovery list response
   *
   * @example
   * ```typescript
   * // List all resources
   * const resources = await list();
   *
   * // List with pagination
   * const resources = await list({ limit: 10, offset: 0 });
   *
   * // Filter by type
   * const resources = await list({ type: "http" });
   * ```
   */
  async function list(
    config: ListDiscoveryResourcesRequest = {}
  ): Promise<ListDiscoveryResourcesResponse> {
    const url = facilitator?.url || DEFAULT_FACILITATOR_URL;

    let headers: Record<string, string> = { "Content-Type": "application/json" };
    if (facilitator?.createAuthHeaders) {
      const authHeaders = await facilitator.createAuthHeaders();
      if (authHeaders.list) {
        headers = { ...headers, ...authHeaders.list };
      }
    }

    // Build query parameters, excluding undefined values
    const params = new URLSearchParams();
    if (config.type !== undefined) params.set("type", config.type);
    if (config.limit !== undefined) params.set("limit", config.limit.toString());
    if (config.offset !== undefined) params.set("offset", config.offset.toString());

    const queryString = params.toString();
    const requestUrl = queryString
      ? `${url}/discovery/resources?${queryString}`
      : `${url}/discovery/resources`;

    const res = await fetch(requestUrl, {
      method: "GET",
      headers,
    });

    if (res.status !== 200) {
      throw new Error(`Failed to list discovery resources: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return data as ListDiscoveryResourcesResponse;
  }

  return { verify, settle, supported, list };
}

// Export a default instance
export const { verify, settle, supported, list } = useFacilitator();

