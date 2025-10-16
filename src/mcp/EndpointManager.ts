/**
 * Endpoint management for dynamic API endpoints.
 * This module provides the EndpointManager class which handles adding, removing,
 * and calling dynamic API endpoints, converting them to MCP tools.
 */

import axios, { AxiosInstance, AxiosResponse } from "axios";
import { APIEndpoint, HTTPMethod } from "../types/api.types.js";
import { MCPTool } from "../types/mcp.types.js";

interface ApiResponse {
  success: boolean;
  status_code?: number;
  data?: any;
  message: string;
}

export class EndpointManager {
  private endpoints: Map<string, APIEndpoint>;
  private tools: Map<string, MCPTool>;
  private httpClient: AxiosInstance;

  constructor() {
    this.endpoints = new Map();
    this.tools = new Map();
    this.httpClient = axios.create({
      validateStatus: () => true, // Don't throw on any status code
    });
    console.log("[EndpointManager] Initialized endpoint manager");
  }

  /**
   * Add a new API endpoint and create a corresponding MCP tool
   *
   * @param endpoint - APIEndpoint configuration to add
   * @throws Error if endpoint name already exists
   */
  addEndpoint(endpoint: APIEndpoint): void {
    if (this.endpoints.has(endpoint.name)) {
      throw new Error(`Endpoint '${endpoint.name}' already exists`);
    }

    this.endpoints.set(endpoint.name, endpoint);

    // Create MCP tool definition
    const tool = this.createEndpointTool(endpoint);
    this.tools.set(endpoint.name, tool);

    console.log(
      `[EndpointManager] Added endpoint '${endpoint.name}' as MCP tool (${endpoint.method} ${endpoint.url})`
    );
  }

  /**
   * Create MCP tool definition from endpoint configuration
   * This replaces the create_endpoint_function from Python
   */
  private createEndpointTool(endpoint: APIEndpoint): MCPTool {
    const properties: Record<string, any> = {};
    const required: string[] = [];

    for (const param of endpoint.parameters) {
      // Map parameter type to JSON Schema type
      let jsonSchemaType: string;
      if (param.type === "string") {
        jsonSchemaType = "string";
      } else if (param.type === "number") {
        jsonSchemaType = "number";
      } else if (param.type === "boolean") {
        jsonSchemaType = "boolean";
      } else if (param.type === "object") {
        jsonSchemaType = "object";
      } else if (param.type === "array") {
        jsonSchemaType = "array";
      } else {
        jsonSchemaType = "string"; // default
      }

      properties[param.name] = {
        type: jsonSchemaType,
        description: param.description,
      };

      if (param.default !== undefined) {
        properties[param.name].default = param.default;
      }

      if (param.required !== false) {
        required.push(param.name);
      }
    }

    return {
      name: endpoint.name,
      description: endpoint.description,
      inputSchema: {
        type: "object",
        properties,
        required,
      },
    };
  }

  /**
   * Call the actual API endpoint with the provided arguments
   * This is the equivalent of _call_api_endpoint from Python
   *
   * @param endpointName - Name of the endpoint to call
   * @param args - Arguments to pass to the API endpoint
   * @returns Dict containing success status, data, and message
   */
  async callApiEndpoint(
    endpointName: string,
    args: Record<string, any>
  ): Promise<ApiResponse> {
    if (!this.endpoints.has(endpointName)) {
      console.error(`[EndpointManager] Endpoint '${endpointName}' not found`);
      return {
        success: false,
        message: `Endpoint '${endpointName}' not found`,
      };
    }

    const endpoint = this.endpoints.get(endpointName)!;
    console.log(
      `[EndpointManager] Calling ${endpoint.method} ${endpoint.url} with args:`,
      args
    );

    try {
      // Validate required parameters
      for (const param of endpoint.parameters) {
        if (param.required !== false && !(param.name in args)) {
          return {
            success: false,
            message: `Missing required parameter: ${param.name}`,
          };
        }
      }

      // Replace path parameters in URL
      let url = endpoint.url;
      for (const [paramName, paramValue] of Object.entries(args)) {
        url = url.replace(`{${paramName}}`, String(paramValue));
      }

      const headers = endpoint.headers ? { ...endpoint.headers } : {};
      const timeout = (endpoint.timeout || 30) * 1000; // Convert to milliseconds

      // Filter out path parameters from request args
      const requestArgs = { ...args };
      if (
        endpoint.method === HTTPMethod.GET ||
        endpoint.method === HTTPMethod.DELETE
      ) {
        for (const paramName of Object.keys(args)) {
          if (endpoint.url.includes(`{${paramName}}`)) {
            delete requestArgs[paramName];
          }
        }
      }

      // Make HTTP request based on method
      let response: AxiosResponse;

      if (endpoint.method === HTTPMethod.GET) {
        response = await this.httpClient.get(url, {
          params: requestArgs,
          headers,
          timeout,
        });
      } else if (
        endpoint.method === HTTPMethod.POST ||
        endpoint.method === HTTPMethod.PUT ||
        endpoint.method === HTTPMethod.PATCH
      ) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
        response = await this.httpClient.request({
          method: endpoint.method,
          url,
          data: args,
          headers,
          timeout,
        });
      } else if (endpoint.method === HTTPMethod.DELETE) {
        response = await this.httpClient.delete(url, {
          params: requestArgs,
          headers,
          timeout,
        });
      } else {
        return {
          success: false,
          message: `Unsupported HTTP method: ${endpoint.method}`,
        };
      }

      return await this.processResponse(response, endpointName);
    } catch (error: any) {
      if (error.code === "ECONNABORTED") {
        const errorMsg = `Request to ${endpoint.url} timed out after ${endpoint.timeout || 30} seconds`;
        console.error(`[EndpointManager] ${errorMsg}`);
        return {
          success: false,
          message: errorMsg,
        };
      }

      console.error(
        `[EndpointManager] Error calling endpoint '${endpointName}':`,
        error
      );
      return {
        success: false,
        message: `Error calling API: ${error.message}`,
      };
    }
  }

  /**
   * Process the HTTP response and return a standardized result
   * This is the equivalent of _process_response from Python
   *
   * @param response - Axios response object
   * @param endpointName - Name of the endpoint that was called
   * @returns Dict containing success status, data, and message
   */
  private async processResponse(
    response: AxiosResponse,
    endpointName: string
  ): Promise<ApiResponse> {
    try {
      const data = response.data;
      const statusCode = response.status;

      if (statusCode >= 200 && statusCode < 300) {
        console.log(
          `[EndpointManager] API call successful: ${endpointName} returned ${statusCode}`
        );
        return {
          success: true,
          status_code: statusCode,
          data: data,
          message: `Successfully called ${endpointName}`,
        };
      } else {
        console.warn(
          `[EndpointManager] API call failed: ${endpointName} returned ${statusCode}`
        );
        return {
          success: false,
          status_code: statusCode,
          data: data,
          message: `API call failed with status ${statusCode}`,
        };
      }
    } catch (error: any) {
      console.error(
        `[EndpointManager] Error processing response from ${endpointName}:`,
        error
      );
      return {
        success: false,
        status_code: response.status,
        message: `Error processing response: ${error.message}`,
      };
    }
  }

  /**
   * Remove an endpoint and its corresponding tool
   *
   * @param endpointName - Name of the endpoint to remove
   * @returns true if endpoint was removed, false if it didn't exist
   */
  removeEndpoint(endpointName: string): boolean {
    const hadEndpoint = this.endpoints.delete(endpointName);
    const hadTool = this.tools.delete(endpointName);
    const removed = hadEndpoint || hadTool;

    if (removed) {
      console.log(`[EndpointManager] Removed endpoint '${endpointName}'`);
    } else {
      console.warn(
        `[EndpointManager] Endpoint '${endpointName}' not found for removal`
      );
    }

    return removed;
  }

  /**
   * Get all registered tools
   *
   * @returns Map of tool name to MCP tool definition
   */
  getTools(): Map<string, MCPTool> {
    return this.tools;
  }

  /**
   * List all configured endpoints
   *
   * @returns Array of endpoint configurations
   */
  listEndpoints(): any[] {
    const result: any[] = [];

    for (const endpoint of this.endpoints.values()) {
      result.push({
        name: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
        description: endpoint.description,
        parameters: endpoint.parameters,
        headers: endpoint.headers,
        timeout: endpoint.timeout,
      });
    }

    return result;
  }
}
