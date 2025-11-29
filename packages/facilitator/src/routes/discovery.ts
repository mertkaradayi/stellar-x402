/**
 * Discovery Route Handler
 *
 * HTTP route handler for the /discovery/resources endpoint.
 * Per x402 spec section 8: Discovery API
 */

import type { Request, Response } from "express";
import {
  listResources,
  registerResource,
  unregisterResource,
  type DiscoveredResource,
  type ListDiscoveryResourcesRequest,
} from "../storage/discovery-store.js";
import { ListDiscoveryResourcesRequestSchema } from "../types/verify/x402Specs.js";

/**
 * GET /discovery/resources
 *
 * Lists discoverable x402 resources with optional filtering and pagination.
 */
export async function listDiscoveryResourcesRoute(req: Request, res: Response): Promise<void> {
  try {
    // Parse query parameters
    const queryParams: ListDiscoveryResourcesRequest = {};

    if (req.query.type && typeof req.query.type === "string") {
      queryParams.type = req.query.type;
    }
    if (req.query.limit) {
      queryParams.limit = parseInt(req.query.limit as string, 10);
    }
    if (req.query.offset) {
      queryParams.offset = parseInt(req.query.offset as string, 10);
    }

    // Validate request params
    const parseResult = ListDiscoveryResourcesRequestSchema.safeParse(queryParams);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Invalid query parameters",
        details: parseResult.error.errors,
      });
      return;
    }

    // Get resources
    const response = await listResources(parseResult.data);

    console.log(`[/discovery/resources] Returning ${response.items.length} of ${response.pagination.total} resources`);

    res.json(response);
  } catch (error) {
    console.error("[/discovery/resources] Error:", error);
    res.status(500).json({
      error: "Internal server error",
    });
  }
}

/**
 * POST /discovery/resources
 *
 * Register a new discoverable resource.
 * Note: This endpoint may require authentication in production.
 */
export async function registerDiscoveryResourceRoute(req: Request, res: Response): Promise<void> {
  try {
    const resource = req.body as DiscoveredResource;

    // Validate required fields
    if (!resource.resource || !resource.type || !resource.accepts) {
      res.status(400).json({
        error: "Missing required fields: resource, type, accepts",
      });
      return;
    }

    // Set defaults
    if (!resource.x402Version) {
      resource.x402Version = 1;
    }
    if (!resource.lastUpdated) {
      resource.lastUpdated = Date.now();
    }

    // Register the resource
    await registerResource(resource);

    console.log(`[/discovery/resources] Registered: ${resource.resource}`);

    res.status(201).json({
      success: true,
      resource: resource.resource,
    });
  } catch (error) {
    console.error("[/discovery/resources] Registration error:", error);
    res.status(500).json({
      error: "Failed to register resource",
    });
  }
}

/**
 * DELETE /discovery/resources
 *
 * Unregister a discovered resource.
 * Note: This endpoint may require authentication in production.
 */
export async function unregisterDiscoveryResourceRoute(req: Request, res: Response): Promise<void> {
  try {
    const { resource: resourceUrl } = req.body as { resource?: string };

    if (!resourceUrl) {
      res.status(400).json({
        error: "Missing required field: resource",
      });
      return;
    }

    const deleted = await unregisterResource(resourceUrl);

    if (deleted) {
      console.log(`[/discovery/resources] Unregistered: ${resourceUrl}`);
      res.json({
        success: true,
        resource: resourceUrl,
      });
    } else {
      res.status(404).json({
        error: "Resource not found",
        resource: resourceUrl,
      });
    }
  } catch (error) {
    console.error("[/discovery/resources] Unregister error:", error);
    res.status(500).json({
      error: "Failed to unregister resource",
    });
  }
}

