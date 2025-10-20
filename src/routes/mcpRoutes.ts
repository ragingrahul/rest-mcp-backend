/**
 * MCP Routes
 * Handles HTTP Streamable connections for MCP protocol
 */

import express, { Router, Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { MCPServerRegistry } from "../mcp/MCPServerRegistry.js";
import {
  getConnectionInfo,
  mcpHealthCheck,
} from "../controllers/mcpController.js";
import { verifyToken } from "../middleware/auth.middleware.js";

// Configure logging
const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warning: (message: string) => console.warn(`[WARNING] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

// Store transport instances per user
const userTransports = new Map<string, StreamableHTTPServerTransport>();

/**
 * Create a fresh MCP server and transport for a user
 * This creates a NEW server instance each time to avoid connection state issues
 */
export async function createFreshTransport(
  userId: string,
  _registry: MCPServerRegistry
): Promise<StreamableHTTPServerTransport> {
  // ALWAYS create a fresh DynamicMCPServer for this connection
  // This avoids the "already connected" issue
  const { DynamicMCPServer } = await import("../mcp/DynamicMCPServer.js");
  const { getEndpointsByUserIdServerSide } = await import(
    "../services/endpointRepository.js"
  );

  // Create a brand new MCP server instance
  const mcpServer = new DynamicMCPServer();

  // Load user's endpoints
  const endpoints = await getEndpointsByUserIdServerSide(userId);

  // Add all endpoints to this fresh server
  for (const endpoint of endpoints) {
    mcpServer.addEndpoint(endpoint);
  }

  const server = mcpServer.getServer();

  // Register capabilities
  server.server.registerCapabilities({
    tools: {
      listChanged: true,
    },
  });

  // Create new transport
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  // Connect the transport to the MCP server
  await server.connect(transport);

  mcpServer.markAsConnected();

  log.info(
    `[MCPRoutes] Created fresh MCP server and transport for user ${userId}`
  );

  return transport;
}

/**
 * Legacy function for backwards compatibility
 */
export async function getOrCreateTransport(
  userId: string,
  registry: MCPServerRegistry
): Promise<StreamableHTTPServerTransport> {
  return createFreshTransport(userId, registry);
}

/**
 * Handle MCP Streamable HTTP connection for a specific user
 */
async function handleMCPConnection(
  req: Request,
  res: Response,
  registry: MCPServerRegistry,
  userId: string
): Promise<void> {
  try {
    log.info(
      `[MCPRoutes] MCP Streamable HTTP connection requested for user ${userId}`
    );

    // Get or create transport for this user
    const transport = await getOrCreateTransport(userId, registry);

    // Handle the request using StreamableHTTPServerTransport
    await transport.handleRequest(req as any, res as any);
  } catch (error: any) {
    log.error(`[MCPRoutes] Error handling MCP connection: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({
        error: "Failed to establish MCP connection",
        message: error.message,
      });
    }
  }
}

/**
 * Resolve username to userId
 */
async function resolveUsername(
  username: string,
  registry: MCPServerRegistry
): Promise<string | null> {
  const userServer = await registry.getServerByUsername(username);

  if (!userServer) {
    return null;
  }

  // Find userId by reverse lookup
  const activeUserIds = registry.getActiveUserIds();
  for (const userId of activeUserIds) {
    if (registry.getServerByUserId(userId) === userServer) {
      return userId;
    }
  }

  return null;
}

/**
 * Create MCP routes
 */
export function createMCPRoutes(registry: MCPServerRegistry): Router {
  const router = express.Router();

  // Developer API: Get connection info (requires auth)
  router.get("/api/mcp/connection", verifyToken, getConnectionInfo);

  // Health check
  router.get("/api/mcp/health", mcpHealthCheck);

  // MCP Streamable HTTP endpoint by user ID (public - no auth required)
  // Handles both GET (SSE) and POST (messages) as per MCP Streamable HTTP spec
  router.all("/mcp/:userId", async (req, res) => {
    const userId = req.params.userId;
    await handleMCPConnection(req, res, registry, userId);
  });

  // MCP Streamable HTTP endpoint by username (public - no auth required)
  router.all("/mcp/u/:username", async (req, res) => {
    const username = req.params.username;

    // Resolve username to userId
    const userId = await resolveUsername(username, registry);

    if (!userId) {
      res.status(404).json({
        error: "MCP server not found for this username",
        username: username,
      });
      return;
    }

    await handleMCPConnection(req, res, registry, userId);
  });

  // Reload endpoint transport for a user (admin/development use)
  // This can be called after adding endpoints to reinitialize the transport
  router.post("/api/mcp/reload/:userId", verifyToken, async (req, res) => {
    try {
      const userId = req.params.userId;

      // Close existing transport if it exists
      if (userTransports.has(userId)) {
        userTransports.delete(userId);
        log.info(`[MCPRoutes] Cleared transport for user ${userId} for reload`);
      }

      // Reload server endpoints
      await registry.reloadServerEndpoints(userId);

      res.json({
        success: true,
        message: "MCP server reloaded successfully",
      });
    } catch (error: any) {
      log.error(`[MCPRoutes] Error reloading MCP server: ${error.message}`);
      res.status(500).json({
        success: false,
        message: `Error reloading MCP server: ${error.message}`,
      });
    }
  });

  return router;
}

/**
 * Cleanup function to close all transports gracefully
 */
export async function closeAllTransports(): Promise<void> {
  log.info(`[MCPRoutes] Closing ${userTransports.size} transport connections`);

  for (const [userId, _transport] of userTransports.entries()) {
    try {
      // Note: StreamableHTTPServerTransport doesn't have a close method
      // but we can clear our references
      userTransports.delete(userId);
      log.info(`[MCPRoutes] Cleared transport for user ${userId}`);
    } catch (error: any) {
      log.error(
        `[MCPRoutes] Error closing transport for user ${userId}: ${error.message}`
      );
    }
  }

  userTransports.clear();
}
