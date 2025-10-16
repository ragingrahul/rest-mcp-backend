/**
 * Health Routes
 * Defines health check routes
 */

import express, { Router } from "express";
import { DynamicMCPServer } from "../mcp/DynamicMCPServer.js";
import { EndpointManager } from "../mcp/EndpointManager.js";
import { healthCheck } from "../controllers/healthController.js";

/**
 * Create and configure health routes
 *
 * @param endpointManager - EndpointManager instance
 * @param dynamicServer - DynamicMCPServer instance
 * @returns Configured Express Router
 */
export function createHealthRoutes(
  endpointManager: EndpointManager,
  dynamicServer: DynamicMCPServer
): Router {
  const router = express.Router();

  // GET /health - Health check
  router.get("/", (req, res) => {
    healthCheck(req, res, endpointManager, dynamicServer);
  });

  return router;
}
