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
