/**
 * MCP Controller
 * Handles MCP-specific endpoints like connection info
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types/auth.types.js";
import { getEndpointCount } from "../services/endpointRepository.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";

// Get logger for this controller
const log = LoggerFactory.getLogger("MCPController");

/**
 * Get MCP connection details for authenticated developer
 */
export async function getConnectionInfo(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;
    const userEmail = authReq.user?.email;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    // Get endpoint count for user
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");
    const endpointCount = await getEndpointCount(userId, accessToken);

    // Get base URL from environment or construct from request
    const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

    // Build connection info
    const connectionInfo = {
      url_by_id: `${baseUrl}/mcp/${userId}`,
      url_by_username: userEmail
        ? `${baseUrl}/mcp/u/${userEmail.split("@")[0]}`
        : undefined,
      format: "streamable-http" as const,
      endpoints_count: endpointCount,
    };

    log.info(`Provided connection info to user ${userId}`);

    res.json({
      success: true,
      connection: connectionInfo,
      usage_instructions: {
        claude_desktop: {
          step1: "Open Claude Desktop settings",
          step2: "Navigate to 'Developer' → 'Edit Config'",
          step3: "Add the following to your mcpServers configuration:",
          config: {
            [userEmail?.split("@")[0] || "my-mcp-server"]: {
              command: "npx",
              args: [
                "-y",
                "@modelcontextprotocol/client-http",
                connectionInfo.url_by_id,
              ],
            },
          },
          step4: "Restart Claude Desktop",
          note: "For Streamable HTTP transport, Claude Desktop uses the HTTP client wrapper",
        },
      },
    });
  } catch (error: any) {
    log.error(`Error getting connection info: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error retrieving connection info: ${error.message}`,
    });
  }
}

/**
 * Health check for MCP endpoint
 */
export async function mcpHealthCheck(
  _req: Request,
  res: Response
): Promise<void> {
  res.json({
    success: true,
    message: "MCP service is running",
    version: "1.0.0",
  });
}
