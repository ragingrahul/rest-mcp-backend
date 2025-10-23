/**
 * Endpoint Routes
 * Defines all endpoint management routes
 */

import express, { Router } from "express";
import { MCPServerRegistry } from "../mcp/MCPServerRegistry.js";
import * as endpointController from "../controllers/endpointController.js";
import { verifyToken } from "../middleware/auth.middleware.js";

/**
 * Create and configure endpoint routes
 * All routes require authentication
 *
 * @param registry - MCPServerRegistry instance
 * @returns Configured Express Router
 */
export function createEndpointRoutes(registry: MCPServerRegistry): Router {
  const router = express.Router();

  // Apply authentication middleware to all endpoint routes
  router.use(verifyToken);

  // GET /api/endpoints/marketplace - Get all developers with endpoints (requires auth)
  router.get("/marketplace", (req, res) => {
    endpointController.getMarketplace(req, res);
  });

  // POST /api/endpoints - Add a new endpoint (requires auth)
  router.post("/", (req, res) => {
    endpointController.addEndpoint(req, res, registry);
  });

  // GET /api/endpoints - List all endpoints (requires auth)
  router.get("/", (req, res) => {
    endpointController.listEndpoints(req, res);
  });

  // PUT /api/endpoints/:id - Update an endpoint (requires auth)
  router.put("/:id", (req, res) => {
    endpointController.updateEndpointController(req, res, registry);
  });

  // DELETE /api/endpoints/:name - Remove an endpoint (requires auth)
  router.delete("/:name", (req, res) => {
    endpointController.removeEndpoint(req, res, registry);
  });

  return router;
}
