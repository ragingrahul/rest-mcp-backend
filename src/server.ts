/**
 * Dynamic MCP HTTP Server
 *
 * This server provides:
 * - MCP protocol via Streamable HTTP at POST /
 * - REST API for managing dynamic endpoints
 * - Health check endpoint
 */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { DynamicMCPServer } from "./mcp/DynamicMCPServer.js";
import { EndpointManager } from "./mcp/EndpointManager.js";
import { loadEndpointsFromFile } from "./utils/endpointUtils.js";
import { createEndpointRoutes } from "./routes/endpointRoutes.js";
import { createHealthRoutes } from "./routes/healthRoutes.js";
import path from "path";
import { fileURLToPath } from "url";

// Configure logging
const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warning: (message: string) => console.warn(`[WARNING] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

// Initialize the endpoint manager and dynamic MCP server
const endpointManager = new EndpointManager();
const dynamicServer = new DynamicMCPServer("dynamic-api-mcp", endpointManager);

/**
 * Main function to start the dynamic MCP HTTP server
 */
async function main(): Promise<void> {
  const port = parseInt(process.env.PORT || "8080", 10);
  const host = process.env.HOST || "0.0.0.0";
  const endpointsFile = process.env.ENDPOINTS_FILE || "endpoints.json";

  // Try to load endpoints from file
  const endpointsPath = path.resolve(process.cwd(), endpointsFile);
  await loadEndpointsFromFile(endpointsPath, dynamicServer);

  // Create Express app
  const app = express();

  // Don't parse JSON for MCP protocol endpoint - let transport handle it
  app.use((req, res, next) => {
    if (req.path === "/" || req.path === "") {
      // Skip body parsing for MCP endpoint
      next();
    } else {
      // Parse JSON for API endpoints
      express.json()(req, res, next);
    }
  });

  // Setup MCP Streamable HTTP transport BEFORE setting up routes
  const mcpServer = dynamicServer.getServer();

  // Register capabilities before connecting
  mcpServer.server.registerCapabilities({
    tools: {
      listChanged: true, // Enable tool list change notifications
    },
  });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode
    enableJsonResponse: true, // Use JSON responses
  });

  // Connect the transport to the MCP server BEFORE handling requests
  await mcpServer.connect(transport);

  // Mark the server as connected (prevents dynamic tool registration after this point)
  dynamicServer.markAsConnected();

  // Handle MCP protocol requests (both GET for SSE and POST for messages)
  app.all("/", async (req, res) => {
    try {
      await transport.handleRequest(req as any, res as any);
    } catch (error: any) {
      log.error(`[DynamicHTTP] Error handling MCP request: ${error.message}`);
      res.status(500).json({
        error: "Internal server error",
        message: error.message,
      });
    }
  });

  // Setup REST API routes AFTER MCP connection
  app.use(
    "/api/endpoints",
    createEndpointRoutes(endpointManager, dynamicServer)
  );
  app.use("/health", createHealthRoutes(endpointManager, dynamicServer));

  // Start the server
  app.listen(port, host, () => {
    log.info(`[DynamicHTTP] Dynamic MCP Server started on ${host}:${port}`);
    log.info("[DynamicHTTP] Available endpoints:");
    log.info(`[DynamicHTTP]   - POST http://${host}:${port}/ (MCP protocol)`);
    log.info(
      `[DynamicHTTP]   - POST http://${host}:${port}/api/endpoints (Add endpoint)`
    );
    log.info(
      `[DynamicHTTP]   - DELETE http://${host}:${port}/api/endpoints/{name} (Remove endpoint)`
    );
    log.info(
      `[DynamicHTTP]   - GET http://${host}:${port}/api/endpoints (List endpoints)`
    );
    log.info(
      `[DynamicHTTP]   - GET http://${host}:${port}/health (Health check)`
    );

    const endpointNames = endpointManager.listEndpoints().map((e) => e.name);
    const toolNames = dynamicServer.listTools();

    log.info(
      `[DynamicHTTP]   - Loaded endpoints: [${endpointNames.join(", ")}]`
    );
    log.info(`[DynamicHTTP]   - Available tools: [${toolNames.join(", ")}]`);

    if (toolNames.length === 0) {
      log.warning(
        "[DynamicHTTP] No tools available! Claude won't see any tools."
      );
    } else {
      log.info(`[DynamicHTTP] ${toolNames.length} tools ready for Claude`);
    }
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    log.info("[DynamicHTTP] Dynamic MCP Server shutting down...");
    await mcpServer.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    log.info("[DynamicHTTP] Dynamic MCP Server shutting down...");
    await mcpServer.close();
    process.exit(0);
  });
}

// Get __filename in ES modules
const __filename = fileURLToPath(import.meta.url);

// Start the server if this is the main module
// In ES modules, we check if the file is being run directly
const isMainModule =
  process.argv[1] === __filename || process.argv[1]?.endsWith("src/server.ts");

if (isMainModule) {
  main().catch((error) => {
    log.error(`[DynamicHTTP] Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

export { main };
