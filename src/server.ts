/**
 * Dynamic MCP HTTP Server
 *
 * This server provides:
 * - Per-user MCP servers via Streamable HTTP at /mcp/{userId}
 * - REST API for managing dynamic endpoints
 * - Authentication system
 * - Health check endpoint
 */

import express from "express";
import { MCPServerRegistry } from "./mcp/MCPServerRegistry.js";
import { createEndpointRoutes } from "./routes/endpointRoutes.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import { createAuthRoutes } from "./routes/authRoutes.js";
import {
  createMCPRoutes,
  closeAllTransports,
  getOrCreateTransport,
} from "./routes/mcpRoutes.js";
import { getAllUsersWithEndpoints } from "./services/endpointRepository.js";

// Configure logging
const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warning: (message: string) => console.warn(`[WARNING] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

/**
 * Main function to start the MCP marketplace server
 */
async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  log.info("[Server] Initializing MCP Marketplace Server...");

  // Initialize the MCP server registry
  const registry = new MCPServerRegistry();

  // Load all users with endpoints and initialize their servers
  try {
    const userIds = await getAllUsersWithEndpoints();
    log.info(`[Server] Found ${userIds.length} users with endpoints`);

    if (userIds.length > 0) {
      await registry.initializeAllServers(userIds);
    }
  } catch (error: any) {
    log.warning(
      `[Server] Could not load endpoints from database: ${error.message}`
    );
    log.warning("[Server] Starting with empty registry");
  }

  // Create Express app
  const app = express();

  // Conditional JSON parsing - SKIP for MCP endpoints
  app.use((req, res, next) => {
    // Don't parse JSON for root MCP endpoint or /mcp/* paths
    // Let StreamableHTTPServerTransport handle raw streams
    if (
      req.path === "/" ||
      req.path.startsWith("/mcp/") ||
      req.path.startsWith("/mcp")
    ) {
      next();
    } else {
      express.json()(req, res, next);
    }
  });

  // CORS middleware (optional - enable if needed for frontend)
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }

    next();
  });

  // Setup routes
  // Authentication routes (public)
  app.use("/api/auth", createAuthRoutes());

  // Endpoint management routes (protected with authentication)
  app.use("/api/endpoints", createEndpointRoutes(registry));

  // MCP routes (includes both public MCP endpoints and protected connection info)
  app.use(createMCPRoutes(registry));

  // Health check routes (public)
  app.use("/health", createHealthRoutes());

  // Root MCP endpoint - serves default user's MCP server
  app.all("/", async (req, res) => {
    try {
      // Get default user ID from environment or use the first user with endpoints
      let defaultUserId = process.env.DEFAULT_MCP_USER_ID;

      if (!defaultUserId) {
        // If no default, use the first active user
        const activeUsers = registry.getActiveUserIds();
        if (activeUsers.length > 0) {
          defaultUserId = activeUsers[0];
          log.info(
            `[Server] Using first active user as default: ${defaultUserId}`
          );
        } else {
          // No users with endpoints yet
          res.status(503).json({
            error: "No MCP servers available",
            message: "Please add endpoints first via POST /api/endpoints",
            help: {
              signup: "POST /api/auth/signup",
              login: "POST /api/auth/login",
              add_endpoint: "POST /api/endpoints (requires auth)",
            },
          });
          return;
        }
      }

      // Handle MCP connection for the default user
      const transport = await getOrCreateTransport(defaultUserId, registry);
      await transport.handleRequest(req as any, res as any);
    } catch (error: any) {
      log.error(`[Server] Error handling root MCP request: ${error.message}`);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal server error",
          message: error.message,
        });
      }
    }
  });

  // Error handling middleware
  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      log.error(`[Server] Unhandled error: ${err.message}`);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }
  );

  // Start the server
  app.listen(port, host, () => {
    log.info(`[Server] ✓ MCP Marketplace Server started on ${host}:${port}`);
    log.info(`[Server] ✓ Active MCP servers: ${registry.getServerCount()}`);
    log.info("");
    log.info("[Server] 📚 API Documentation:");
    log.info("");
    log.info("  Authentication:");
    log.info(`    POST   http://${host}:${port}/api/auth/signup`);
    log.info(`    POST   http://${host}:${port}/api/auth/login`);
    log.info(
      `    GET    http://${host}:${port}/api/auth/profile (auth required)`
    );
    log.info(
      `    POST   http://${host}:${port}/api/auth/logout (auth required)`
    );
    log.info(`    POST   http://${host}:${port}/api/auth/refresh`);
    log.info("");
    log.info("  Endpoint Management (auth required):");
    log.info(`    POST   http://${host}:${port}/api/endpoints`);
    log.info(`    GET    http://${host}:${port}/api/endpoints`);
    log.info(`    PUT    http://${host}:${port}/api/endpoints/:id`);
    log.info(`    DELETE http://${host}:${port}/api/endpoints/:name`);
    log.info("");
    log.info("  MCP Connections:");
    log.info(
      `    GET    http://${host}:${port}/api/mcp/connection (get your MCP URL)`
    );
    log.info(
      `    GET    http://${host}:${port}/mcp/:userId (connect to user's MCP server)`
    );
    log.info(
      `    GET    http://${host}:${port}/mcp/u/:username (connect by username)`
    );
    log.info(`    POST   http://${host}:${port}/mcp/:userId (call MCP tools)`);
    log.info("");
    log.info("  Health:");
    log.info(`    GET    http://${host}:${port}/health`);
    log.info("");
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    log.info("[Server] Shutting down gracefully...");
    await closeAllTransports();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    log.info("[Server] Shutting down gracefully...");
    await closeAllTransports();
    process.exit(0);
  });
}

// Start the server
main().catch((error) => {
  log.error(`[Server] Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

export { main };
