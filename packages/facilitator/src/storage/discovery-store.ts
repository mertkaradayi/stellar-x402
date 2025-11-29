/**
 * Discovery Store
 *
 * Storage for discovered x402 resources (Bazaar).
 * Uses Redis for persistence with in-memory fallback.
 */

import { getRedisClient } from "./redis.js";

// ============================================================================
// Types
// ============================================================================

export interface DiscoveredResource {
  resource: string;
  type: "http";
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra?: Record<string, unknown> | null;
  }>;
  lastUpdated: number;
  metadata?: Record<string, unknown>;
}

export interface ListDiscoveryResourcesRequest {
  type?: string;
  limit?: number;
  offset?: number;
}

export interface ListDiscoveryResourcesResponse {
  x402Version: number;
  items: DiscoveredResource[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

const DISCOVERY_RESOURCES_KEY = "x402:discovery:resources";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// In-memory fallback for development
const memoryStore = new Map<string, DiscoveredResource>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the storage mode (redis or memory)
 */
function useRedis(): boolean {
  return getRedisClient() !== null;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Register a new discovered resource
 *
 * @param resource - The resource to register
 */
export async function registerResource(resource: DiscoveredResource): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    // Store in Redis as a hash field (keyed by resource URL)
    await redis.hSet(
      DISCOVERY_RESOURCES_KEY,
      resource.resource,
      JSON.stringify(resource)
    );
    console.log(`[discovery] Registered resource: ${resource.resource}`);
  } else {
    // Fallback to memory
    memoryStore.set(resource.resource, resource);
    console.log(`[discovery] Registered resource (memory): ${resource.resource}`);
  }
}

/**
 * Unregister a discovered resource
 *
 * @param resourceUrl - The URL of the resource to unregister
 */
export async function unregisterResource(resourceUrl: string): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    const deleted = await redis.hDel(DISCOVERY_RESOURCES_KEY, resourceUrl);
    if (deleted > 0) {
      console.log(`[discovery] Unregistered resource: ${resourceUrl}`);
      return true;
    }
    return false;
  } else {
    const existed = memoryStore.has(resourceUrl);
    memoryStore.delete(resourceUrl);
    if (existed) {
      console.log(`[discovery] Unregistered resource (memory): ${resourceUrl}`);
    }
    return existed;
  }
}

/**
 * Get a specific discovered resource
 *
 * @param resourceUrl - The URL of the resource
 * @returns The resource or null if not found
 */
export async function getResource(resourceUrl: string): Promise<DiscoveredResource | null> {
  const redis = getRedisClient();

  if (redis) {
    const data = await redis.hGet(DISCOVERY_RESOURCES_KEY, resourceUrl);
    if (data) {
      return JSON.parse(data) as DiscoveredResource;
    }
    return null;
  } else {
    return memoryStore.get(resourceUrl) || null;
  }
}

/**
 * List discovered resources with pagination and filtering
 *
 * @param request - Optional request parameters
 * @returns Paginated list of discovered resources
 */
export async function listResources(
  request: ListDiscoveryResourcesRequest = {}
): Promise<ListDiscoveryResourcesResponse> {
  const limit = Math.min(request.limit || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = request.offset || 0;
  const typeFilter = request.type;

  const redis = getRedisClient();
  let allResources: DiscoveredResource[];

  if (redis) {
    // Get all resources from Redis hash
    const resourcesMap = await redis.hGetAll(DISCOVERY_RESOURCES_KEY);
    allResources = Object.values(resourcesMap).map(
      (data) => JSON.parse(data) as DiscoveredResource
    );
  } else {
    // Get from memory
    allResources = Array.from(memoryStore.values());
  }

  // Apply type filter if specified
  let filteredResources = allResources;
  if (typeFilter) {
    filteredResources = allResources.filter((r) => r.type === typeFilter);
  }

  // Sort by lastUpdated (newest first)
  filteredResources.sort((a, b) => b.lastUpdated - a.lastUpdated);

  // Calculate pagination
  const total = filteredResources.length;
  const paginatedResources = filteredResources.slice(offset, offset + limit);

  return {
    x402Version: 1,
    items: paginatedResources,
    pagination: {
      limit,
      offset,
      total,
    },
  };
}

/**
 * Update a resource's lastUpdated timestamp
 *
 * @param resourceUrl - The URL of the resource
 */
export async function touchResource(resourceUrl: string): Promise<void> {
  const resource = await getResource(resourceUrl);
  if (resource) {
    resource.lastUpdated = Date.now();
    await registerResource(resource);
  }
}

/**
 * Clear all discovered resources (useful for testing)
 */
export async function clearAllResources(): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    await redis.del(DISCOVERY_RESOURCES_KEY);
    console.log("[discovery] Cleared all resources from Redis");
  } else {
    memoryStore.clear();
    console.log("[discovery] Cleared all resources from memory");
  }
}

/**
 * Get the total count of discovered resources
 */
export async function getResourceCount(): Promise<number> {
  const redis = getRedisClient();

  if (redis) {
    return await redis.hLen(DISCOVERY_RESOURCES_KEY);
  } else {
    return memoryStore.size;
  }
}

