/**
 * Endpoint Utility Functions
 * Helper functions for endpoint operations
 */

import { APIEndpoint, APIParameter, HTTPMethod } from "../types/api.types.js";
import { DynamicMCPServer } from "../mcp/DynamicMCPServer.js";
import fs from "fs/promises";

// Configure logging
const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warning: (message: string) => console.warn(`[WARNING] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

/**
 * Create an APIEndpoint from a configuration object
 *
 * @param config - Configuration object containing endpoint details
 * @returns APIEndpoint instance
 * @throws Error if required configuration is missing or invalid
 */
export function createEndpointFromConfig(config: any): APIEndpoint {
  if (!config.name || !config.url || !config.method || !config.description) {
    throw new Error("Missing required fields: name, url, method, description");
  }

  const parameters: APIParameter[] = (config.parameters || []).map(
    (param: any) => ({
      name: param.name,
      type: param.type,
      description: param.description,
      location: param.location || "body", // Default to body if not specified
      required: param.required !== false,
      default: param.default,
    })
  );

  return {
    name: config.name,
    url: config.url,
    method: config.method as HTTPMethod,
    description: config.description,
    parameters,
    headers: config.headers,
    timeout: config.timeout || 30,
  };
}

/**
 * Load endpoints from a JSON file if it exists
 *
 * @param filePath - Path to the endpoints JSON file
 * @param dynamicServer - DynamicMCPServer instance to add endpoints to
 */
export async function loadEndpointsFromFile(
  filePath: string,
  dynamicServer: DynamicMCPServer
): Promise<void> {
  try {
    const fileContent = await fs.readFile(filePath, "utf-8");
    const endpoints = JSON.parse(fileContent);

    if (!Array.isArray(endpoints)) {
      throw new Error(
        "Endpoints file must contain an array of endpoint configurations"
      );
    }

    let loadedCount = 0;
    for (const config of endpoints) {
      try {
        const endpoint = createEndpointFromConfig(config);
        dynamicServer.addEndpoint(endpoint);
        loadedCount++;
      } catch (error: any) {
        log.error(
          `[EndpointUtils] Failed to load endpoint '${config.name}': ${error.message}`
        );
      }
    }

    log.info(
      `[EndpointUtils] Loaded ${loadedCount} endpoint(s) from ${filePath}`
    );
  } catch (error: any) {
    if (error.code === "ENOENT") {
      log.info(
        `[EndpointUtils] No endpoints file found at ${filePath}, starting with empty configuration`
      );
    } else {
      log.error(
        `[EndpointUtils] Error loading endpoints from file: ${error.message}`
      );
    }
  }
}
