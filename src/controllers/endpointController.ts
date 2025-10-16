/**
 * Endpoint Controller
 * Handles all endpoint-related business logic
 */

import { Request, Response } from "express";
import { DynamicMCPServer } from "../mcp/DynamicMCPServer.js";
import { EndpointManager } from "../mcp/EndpointManager.js";
import { createEndpointFromConfig } from "../utils/endpointUtils.js";

// Configure logging
const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warning: (message: string) => console.warn(`[WARNING] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

/**
 * Add a new API endpoint
 */
export async function addEndpoint(
  req: Request,
  res: Response,
  dynamicServer: DynamicMCPServer
): Promise<void> {
  try {
    const endpoint = createEndpointFromConfig(req.body);
    dynamicServer.addEndpoint(endpoint);

    log.info(
      `[EndpointController] Successfully added endpoint '${endpoint.name}'`
    );
    res.json({
      success: true,
      message: `Successfully added endpoint '${endpoint.name}'`,
      endpoint: {
        name: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
      },
    });
  } catch (error: any) {
    log.error(`[EndpointController] Error adding endpoint: ${error.message}`);
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
  dynamicServer: DynamicMCPServer
): Promise<void> {
  try {
    const endpointName = req.params.name;

    if (!endpointName) {
      log.warning("[EndpointController] Remove endpoint called without name");
      res.status(400).json({
        success: false,
        message: "Endpoint name is required",
      });
      return;
    }

    const removed = dynamicServer.removeEndpoint(endpointName);

    if (removed) {
      log.info(
        `[EndpointController] Successfully removed endpoint '${endpointName}'`
      );
      res.json({
        success: true,
        message: `Successfully removed endpoint '${endpointName}'`,
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Endpoint '${endpointName}' not found`,
      });
    }
  } catch (error: any) {
    log.error(`[EndpointController] Error removing endpoint: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error removing endpoint: ${error.message}`,
    });
  }
}

/**
 * List all configured endpoints
 */
export async function listEndpoints(
  _req: Request,
  res: Response,
  endpointManager: EndpointManager
): Promise<void> {
  try {
    const endpoints = endpointManager.listEndpoints();
    res.json({
      success: true,
      endpoints,
      count: endpoints.length,
    });
  } catch (error: any) {
    log.error(`[EndpointController] Error listing endpoints: ${error.message}`);
    res.status(500).json({
      success: false,
      message: `Error listing endpoints: ${error.message}`,
    });
  }
}
