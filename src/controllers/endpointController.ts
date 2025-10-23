/**
 * Endpoint Controller
 * Handles all endpoint-related business logic
 */

import { Request, Response } from "express";
import { MCPServerRegistry } from "../mcp/MCPServerRegistry.js";
import { createEndpointFromConfig } from "../utils/endpointUtils.js";
import { AuthenticatedRequest } from "../types/auth.types.js";
import {
  createEndpoint,
  deleteEndpointByName,
  getEndpointsByUserId,
  updateEndpoint,
} from "../services/endpointRepository.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";

// Get logger for this controller
const log = LoggerFactory.getLogger("EndpointController");

/**
 * Add a new API endpoint
 */
export async function addEndpoint(
  req: Request,
  res: Response,
  registry: MCPServerRegistry
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Validate and create endpoint object
    const endpoint = createEndpointFromConfig(req.body);

    // Extract access token from request
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    // Save to Supabase
    const savedEndpoint = await createEndpoint(userId, endpoint, accessToken);

    // Get or create user's MCP server and add endpoint
    const userServer = await registry.getOrCreateServer(userId);
    userServer.addEndpoint(savedEndpoint);

    log.info(
      `Successfully added endpoint '${endpoint.name}' for user ${userId}`
    );

    res.json({
      success: true,
      message: `Successfully added endpoint '${endpoint.name}'`,
      endpoint: {
        id: savedEndpoint.id,
        name: savedEndpoint.name,
        url: savedEndpoint.url,
        method: savedEndpoint.method,
      },
    });
  } catch (error: any) {
    log.error(`Error adding endpoint: ${error.message}`, error);
    res.status(400).json({
      success: false,
      message: `Error adding endpoint: ${error.message}`,
    });
  }
}

/**
 * Remove an API endpoint
 */
export async function removeEndpoint(
  req: Request,
  res: Response,
  registry: MCPServerRegistry
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const endpointName = req.params.name;

    if (!endpointName) {
      log.warning("Remove endpoint called without name");
      res.status(400).json({
        success: false,
        message: "Endpoint name is required",
      });
      return;
    }

    // Extract access token
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    // Delete from Supabase
    const deleted = await deleteEndpointByName(
      userId,
      endpointName,
      accessToken
    );

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: `Endpoint '${endpointName}' not found`,
      });
      return;
    }

    // Remove from user's MCP server
    const userServer = registry.getServerByUserId(userId);
    if (userServer) {
      userServer.removeEndpoint(endpointName);
    }

    log.info(
      `Successfully removed endpoint '${endpointName}' for user ${userId}`
    );

    res.json({
      success: true,
      message: `Successfully removed endpoint '${endpointName}'`,
    });
  } catch (error: any) {
    log.error(`Error removing endpoint: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error removing endpoint: ${error.message}`,
    });
  }
}

/**
 * List all configured endpoints for the authenticated user
 */
export async function listEndpoints(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Extract access token
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    // Fetch from Supabase
    const endpoints = await getEndpointsByUserId(userId, accessToken);

    res.json({
      success: true,
      endpoints,
      count: endpoints.length,
    });
  } catch (error: any) {
    log.error(`Error listing endpoints: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error listing endpoints: ${error.message}`,
    });
  }
}

/**
 * Update an existing endpoint
 */
export async function updateEndpointController(
  req: Request,
  res: Response,
  registry: MCPServerRegistry
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const endpointId = req.params.id;

    if (!endpointId) {
      res.status(400).json({
        success: false,
        message: "Endpoint ID is required",
      });
      return;
    }

    // Extract access token
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    // Update in Supabase
    const updatedEndpoint = await updateEndpoint(
      userId,
      endpointId,
      req.body,
      accessToken
    );

    // Reload the user's server to reflect changes
    await registry.reloadServerEndpoints(userId);

    log.info(`Successfully updated endpoint ${endpointId} for user ${userId}`);

    res.json({
      success: true,
      message: "Endpoint updated successfully",
      endpoint: updatedEndpoint,
    });
  } catch (error: any) {
    log.error(`Error updating endpoint: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error updating endpoint: ${error.message}`,
    });
  }
}

/**
 * Get marketplace - list all developers with their endpoints
 */
export async function getMarketplace(
  _req: Request,
  res: Response
): Promise<void> {
  try {
    // Import supabase here to avoid circular dependencies
    const { supabase } = await import("../services/supabase.js");

    // Fetch all endpoints from Supabase
    const { data: endpoints, error: endpointsError } = await supabase
      .from("endpoints")
      .select("*")
      .order("created_at", { ascending: false });

    if (endpointsError) {
      throw new Error(`Failed to fetch endpoints: ${endpointsError.message}`);
    }

    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name");

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    // Fetch all endpoint pricing
    const { data: pricing, error: pricingError } = await supabase
      .from("endpoint_pricing")
      .select("endpoint_id, price_per_call_eth, developer_wallet_address");

    if (pricingError) {
      log.warning(`Failed to fetch pricing: ${pricingError.message}`);
    } else {
      log.info(`Fetched ${pricing?.length || 0} pricing records`);
    }

    // Create a map of user_id to profile
    const profileMap = new Map(
      profiles?.map((profile) => [profile.id, profile]) || []
    );

    // Create a map of endpoint_id to pricing
    const pricingMap = new Map(pricing?.map((p) => [p.endpoint_id, p]) || []);

    // Group endpoints by developer
    const developerMap = new Map<string, any>();

    endpoints?.forEach((endpoint: any) => {
      const userId = endpoint.user_id;
      const profile = profileMap.get(userId);

      if (!developerMap.has(userId)) {
        developerMap.set(userId, {
          id: userId,
          email: profile?.email || "Unknown",
          full_name: profile?.full_name,
          endpoints: [],
          endpoint_count: 0,
        });
      }

      const developer = developerMap.get(userId);
      const endpointPricing = pricingMap.get(endpoint.id);

      // Log pricing info for debugging
      if (endpointPricing) {
        log.info(
          `Found pricing for endpoint ${endpoint.name}: ${endpointPricing.price_per_call_eth} ETH`
        );
      }

      developer.endpoints.push({
        id: endpoint.id,
        name: endpoint.name,
        description: endpoint.description,
        url: endpoint.url,
        method: endpoint.method,
        user_id: endpoint.user_id,
        created_at: endpoint.created_at,
        updated_at: endpoint.updated_at,
        is_paid: !!endpointPricing,
        price_per_call_eth: endpointPricing?.price_per_call_eth || null,
        developer_wallet_address:
          endpointPricing?.developer_wallet_address || null,
      });
      developer.endpoint_count += 1;
    });

    const developers = Array.from(developerMap.values());

    log.info(`Fetched marketplace with ${developers.length} developers`);

    res.json({
      success: true,
      developers,
      total_developers: developers.length,
      total_endpoints: endpoints?.length || 0,
    });
  } catch (error: any) {
    log.error(`Error fetching marketplace: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error fetching marketplace: ${error.message}`,
    });
  }
}
