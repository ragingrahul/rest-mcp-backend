/**
 * Core MCP server implementation for dynamic API endpoints.
 * This module provides the DynamicMCPServer class which serves as the main
 * MCP server that handles tool listing and execution using an EndpointManager.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { EndpointManager } from "./EndpointManager.js";
import { APIEndpoint } from "../types/api.types.js";
import { MCPTool } from "../types/mcp.types.js";
import { RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export class DynamicMCPServer {
  private server: McpServer;
  private endpointManager: EndpointManager;
  private registeredTools: Map<string, RegisteredTool>;
  private isConnected: boolean = false;

  /**
   * Pure MCP Server that serves tools from an EndpointManager
   *
   * This server focuses solely on MCP protocol handling (list_tools, call_tool)
   * and delegates all endpoint management to an EndpointManager instance.
   *
   * @param serverName - Name for the MCP server instance
   * @param endpointManager - EndpointManager instance to get tools from
   */
  constructor(
    serverName: string = "dynamic-mcp-server",
    endpointManager?: EndpointManager
  ) {
    this.endpointManager = endpointManager || new EndpointManager();
    this.registeredTools = new Map();
    this.server = new McpServer({
      name: serverName,
      version: "1.0.0",
    });

    this.setupServer();
    console.log(`[DynamicMCP] Initialized MCP server '${serverName}'`);
  }

  /**
   * Mark the server as connected to a transport
   * This prevents certain operations that can only be done before connection
   */
  markAsConnected(): void {
    this.isConnected = true;
    console.log(`[DynamicMCP] Server marked as connected to transport`);
  }

  /**
   * Setup the MCP server with dynamic tools
   *
   * This method converts the JSON Schema from EndpointManager tools
   * into Zod schemas and registers them with the MCP server.
   */
  private setupServer(): void {
    // Register any tools that already exist in the endpoint manager
    for (const [toolName, tool] of this.endpointManager.getTools()) {
      this.registerTool(toolName, tool);
    }
  }

  /**
   * Register a single tool with the MCP server
   *
   * @param toolName - Name of the tool to register
   * @param tool - MCPTool definition from EndpointManager
   */
  private registerTool(toolName: string, tool: MCPTool): void {
    try {
      // Convert JSON Schema properties to Zod schema
      const zodSchema = this.jsonSchemaToZod(tool.inputSchema);

      const registeredTool = this.server.tool(
        toolName,
        tool.description || "",
        zodSchema,
        async (args) => {
          console.log(
            `[DynamicMCP] Tool call: ${toolName} with args:`,
            JSON.stringify(args)
          );

          try {
            // Call the API endpoint
            const result = await this.endpointManager.callApiEndpoint(
              toolName,
              args || {}
            );
            console.log(
              `[DynamicMCP] Tool '${toolName}' execution result:`,
              result
            );

            let formattedMessage: string;

            if (typeof result === "object" && result !== null) {
              if (result.success) {
                const data = result.data;
                if (data) {
                  formattedMessage = `${result.message || "Success"}\n\nResponse Data:\n${JSON.stringify(data, null, 2)}`;
                } else {
                  formattedMessage =
                    result.message || "Success - no data returned";
                }
              } else {
                formattedMessage = result.message || "Unknown error occurred";
              }
            } else {
              formattedMessage = String(result);
            }

            return {
              content: [
                {
                  type: "text" as const,
                  text: formattedMessage,
                },
              ],
            };
          } catch (error: any) {
            console.error(
              `[DynamicMCP] Error executing tool '${toolName}':`,
              error
            );
            return {
              content: [
                {
                  type: "text" as const,
                  text: `Error executing tool: ${error.message}`,
                },
              ],
            };
          }
        }
      );

      // Store the registered tool so we can manage it later
      this.registeredTools.set(toolName, registeredTool);
      console.log(`[DynamicMCP] Registered tool '${toolName}'`);
    } catch (error: any) {
      console.error(`[DynamicMCP] Error registering tool ${toolName}:`, error);
    }
  }

  /**
   * Convert JSON Schema to Zod schema
   * This is a simplified converter for common types
   */
  private jsonSchemaToZod(inputSchema: any): Record<string, z.ZodTypeAny> {
    const zodSchema: Record<string, z.ZodTypeAny> = {};

    if (!inputSchema || !inputSchema.properties) {
      return zodSchema;
    }

    for (const [propName, propDef] of Object.entries(inputSchema.properties)) {
      const prop = propDef as any;
      let zodType: z.ZodTypeAny;

      // Map JSON Schema types to Zod types
      switch (prop.type) {
        case "string":
          zodType = z.string();
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        case "number":
          zodType = z.number();
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        case "boolean":
          zodType = z.boolean();
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        case "object":
          zodType = z.record(z.any());
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        case "array":
          zodType = z.array(z.any());
          if (prop.description) {
            zodType = zodType.describe(prop.description);
          }
          break;
        default:
          zodType = z.string();
      }

      // Handle optional fields (not in required array)
      const isRequired =
        inputSchema.required && inputSchema.required.includes(propName);
      if (!isRequired && prop.default === undefined) {
        zodType = zodType.optional();
      }

      zodSchema[propName] = zodType;
    }

    return zodSchema;
  }

  /**
   * Get the configured MCP server instance
   *
   * @returns The underlying MCP Server instance
   */
  getServer(): McpServer {
    return this.server;
  }

  /**
   * Get the endpoint manager instance
   *
   * @returns The EndpointManager instance
   */
  getEndpointManager(): EndpointManager {
    return this.endpointManager;
  }

  /**
   * Add a new API endpoint and register it as an MCP tool
   *
   * @param endpoint - APIEndpoint configuration to add
   * @throws Error if endpoint name already exists
   */
  addEndpoint(endpoint: APIEndpoint): void {
    if (this.isConnected) {
      console.warn(
        `[DynamicMCP] Cannot dynamically add endpoint '${endpoint.name}' after server is connected to transport. ` +
          `This is a limitation of the MCP SDK. Endpoint added to manager but not registered as tool.`
      );
    }

    // Add to endpoint manager
    this.endpointManager.addEndpoint(endpoint);

    // Get the newly created tool
    const tool = this.endpointManager.getTools().get(endpoint.name);
    if (tool && !this.isConnected) {
      // Register with MCP server (only before connection)
      this.registerTool(endpoint.name, tool);
      console.log(`[DynamicMCP] Added endpoint '${endpoint.name}' as MCP tool`);
    } else if (tool && this.isConnected) {
      // After connection, we can't register new tools dynamically
      // This is a limitation of the current MCP SDK
      console.log(
        `[DynamicMCP] Added endpoint '${endpoint.name}' to manager (tool registration disabled after connection)`
      );
    }

    // Try to notify clients if connected and capability is available
    if (this.isConnected) {
      try {
        const capabilities = this.server.server.getClientCapabilities();
        if (capabilities && (capabilities as any).tools?.listChanged) {
          this.server.sendToolListChanged();
          console.log(`[DynamicMCP] Notified clients of tool list change`);
        }
      } catch (error: any) {
        console.warn(`[DynamicMCP] Failed to notify clients: ${error.message}`);
      }
    }
  }

  /**
   * Remove an API endpoint and unregister its MCP tool
   *
   * @param endpointName - Name of the endpoint to remove
   * @returns true if endpoint was removed, false if it didn't exist
   */
  removeEndpoint(endpointName: string): boolean {
    // Remove from MCP server first
    const registeredTool = this.registeredTools.get(endpointName);
    if (registeredTool) {
      registeredTool.remove();
      this.registeredTools.delete(endpointName);
    }

    // Remove from endpoint manager
    const removed = this.endpointManager.removeEndpoint(endpointName);

    if (removed) {
      // Notify clients that the tool list has changed
      this.server.sendToolListChanged();
      console.log(
        `[DynamicMCP] Removed endpoint '${endpointName}' and notified clients`
      );
    }

    return removed;
  }

  /**
   * List all registered tools
   *
   * @returns Array of tool names
   */
  listTools(): string[] {
    return Array.from(this.registeredTools.keys());
  }

  /**
   * Check if a tool is registered
   *
   * @param toolName - Name of the tool to check
   * @returns true if the tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.registeredTools.has(toolName);
  }
}
