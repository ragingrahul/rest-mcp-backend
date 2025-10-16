/**
 * Health Controller
 * Handles health check endpoint
 */

import { Request, Response } from "express";
import { DynamicMCPServer } from "../mcp/DynamicMCPServer.js";
import { EndpointManager } from "../mcp/EndpointManager.js";

/**
 * Health check endpoint
 */
export async function healthCheck(
  _req: Request,
  res: Response,
  endpointManager: EndpointManager,
  dynamicServer: DynamicMCPServer
): Promise<void> {
  res.json({
    status: "healthy",
    server: "dynamic-mcp-server",
    endpoints_count: endpointManager.listEndpoints().length,
    tools_count: dynamicServer.listTools().length,
  });
}
