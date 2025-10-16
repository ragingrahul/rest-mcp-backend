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

/**
 * Create and configure endpoint routes
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

  // POST /api/endpoints - Add a new endpoint
  router.post("/", (req, res) => {
    addEndpoint(req, res, dynamicServer);
  });

  // GET /api/endpoints - List all endpoints
  router.get("/", (req, res) => {
    listEndpoints(req, res, endpointManager);
  });

  // DELETE /api/endpoints/:name - Remove an endpoint
  router.delete("/:name", (req, res) => {
    removeEndpoint(req, res, dynamicServer);
  });

  return router;
}
