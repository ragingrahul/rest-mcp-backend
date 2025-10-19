/**
 * Endpoint Routes
 * Defines all endpoint management routes
 */

import express, { Router } from "express";
import { DynamicMCPServer } from "../mcp/DynamicMCPServer.js";
import { EndpointManager } from "../mcp/EndpointManager.js";
import {
  addEndpoint,
  removeEndpoint,
  listEndpoints,
} from "../controllers/endpointController.js";
import { verifyToken } from "../middleware/auth.middleware.js";

/**
 * Create and configure endpoint routes
 * All routes require authentication
 *
 * @param endpointManager - EndpointManager instance
 * @param dynamicServer - DynamicMCPServer instance
 * @returns Configured Express Router
 */
export function createEndpointRoutes(
  endpointManager: EndpointManager,
  dynamicServer: DynamicMCPServer
): Router {
  const router = express.Router();

  // Apply authentication middleware to all endpoint routes
  router.use(verifyToken);

  // POST /api/endpoints - Add a new endpoint (requires auth)
  router.post("/", (req, res) => {
    addEndpoint(req, res, dynamicServer);
  });

  // GET /api/endpoints - List all endpoints (requires auth)
  router.get("/", (req, res) => {
    listEndpoints(req, res, endpointManager);
  });

  // DELETE /api/endpoints/:name - Remove an endpoint (requires auth)
  router.delete("/:name", (req, res) => {
    removeEndpoint(req, res, dynamicServer);
  });

  return router;
}
