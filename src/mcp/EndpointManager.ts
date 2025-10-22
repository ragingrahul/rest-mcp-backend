/**
 * Endpoint management for dynamic API endpoints.
 * This module provides the EndpointManager class which handles adding, removing,
 * and calling dynamic API endpoints, converting them to MCP tools.
 */

import { APIEndpoint, HTTPMethod } from "../types/api.types.js";
import { MCPTool } from "../types/mcp.types.js";
import { IHttpClient } from "../core/interfaces/IHttpClient.js";
import { ILogger } from "../core/interfaces/ILogger.js";
import { AxiosHttpClient } from "../infrastructure/http/AxiosHttpClient.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";

interface ApiResponse {
  success: boolean;
  status_code?: number;
  data?: any;
  message: string;
  payment_details?: any; // For 402 Payment Required responses
}

export class EndpointManager {
  private endpoints: Map<string, APIEndpoint>;
  private tools: Map<string, MCPTool>;
  private httpClient: IHttpClient;
  private logger: ILogger;

  constructor(httpClient?: IHttpClient, logger?: ILogger) {
    this.endpoints = new Map();
    this.tools = new Map();
    this.httpClient = httpClient || new AxiosHttpClient();
    this.logger = logger || LoggerFactory.getLogger("EndpointManager");
    this.logger.info("Initialized endpoint manager");
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

    this.logger.info(
      `Added endpoint '${endpoint.name}' as MCP tool (${endpoint.method} ${endpoint.url})`
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

    // Add _payment_id as an optional parameter for paid tools
    // This allows Claude to include it after payment approval
    properties["_payment_id"] = {
      type: "string",
      description:
        "Payment ID from approve_payment tool. Include this after approving payment to use your paid transaction. Without this, you'll be charged again!",
    };

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
   * Check if payment is required and verify payment status
   * Returns ApiResponse with 402 if payment required but not satisfied
   * Returns null if payment is not required or already satisfied
   *
   * @param endpointId - ID of the endpoint being called
   * @param endUserId - ID of end user who pays for the tool
   * @param developerId - ID of developer who receives the payment
   * @param args - Tool arguments
   */
  private async checkPaymentRequired(
    endpointId: string,
    endUserId: string,
    developerId: string,
    args: Record<string, any>
  ): Promise<ApiResponse | null> {
    try {
      // Dynamic imports to avoid circular dependencies
      const { getPricingByEndpointId } = await import(
        "../services/pricingRepository.js"
      );
      const { getBalanceByUserId } = await import(
        "../services/balanceRepository.js"
      );
      const { getPaymentByPaymentId, createPaymentTransaction } = await import(
        "../services/paymentRepository.js"
      );
      const { PLATFORM_WALLET_ADDRESS } = await import(
        "../controllers/paymentController.js"
      );

      // Check if endpoint has pricing
      const pricing = await getPricingByEndpointId(endpointId);

      if (!pricing || parseFloat(pricing.price_per_call_eth) <= 0) {
        // No payment required
        return null;
      }

      // Check if payment_id is provided in args
      const paymentId = args._payment_id;

      if (paymentId) {
        this.logger.info(`Payment ID provided: ${paymentId}, verifying...`);
        // Verify the payment
        const payment = await getPaymentByPaymentId(paymentId);

        if (!payment) {
          return {
            success: false,
            status_code: 402,
            message: "Invalid payment_id provided",
          };
        }

        if (payment.user_id !== endUserId) {
          return {
            success: false,
            status_code: 402,
            message: "Unauthorized: payment_id belongs to another user",
          };
        }

        if (payment.endpoint_id !== endpointId) {
          return {
            success: false,
            status_code: 402,
            message: "payment_id is for a different endpoint",
          };
        }

        // Check if payment is completed
        if (payment.status === "completed") {
          // Payment verified and completed - allow tool execution
          this.logger.info(
            `✓ Payment ${paymentId} verified as completed, proceeding with tool execution`
          );
          // Remove _payment_id from args so it doesn't get passed to API
          delete args._payment_id;
          return null; // Payment satisfied - tool will execute
        }

        // Payment exists but not completed yet
        this.logger.warning(
          `Payment ${paymentId} status: ${payment.status} (not completed)`
        );
        return {
          success: false,
          status_code: 402,
          message: `Payment ${paymentId} status is ${payment.status}, not completed`,
          payment_details: {
            payment_id: paymentId,
            status: payment.status,
            message:
              payment.status === "pending"
                ? "Call approve_payment tool to complete this payment"
                : `Payment status: ${payment.status}. Cannot proceed.`,
          },
        };
      }

      // No payment_id provided - need to create pending payment
      // Check END USER's balance (who will pay)
      const endUserBalance = await getBalanceByUserId(endUserId);

      if (!endUserBalance) {
        return {
          success: false,
          status_code: 402,
          message: "Payment Required - No balance found for end user",
          payment_details: {
            amount_eth: pricing.price_per_call_eth,
            developer_wallet: pricing.developer_wallet_address,
            developer_id: developerId,
            next_step:
              "Call get_deposit_address tool to get deposit instructions and fund your account",
          },
        };
      }

      // Check END USER's balance (not developer's!)
      const currentBalance = parseFloat(endUserBalance.balance_eth);
      const requiredAmount = parseFloat(pricing.price_per_call_eth);

      // Create pending payment FROM end user TO developer
      const payment = await createPaymentTransaction(
        endUserId, // END USER pays
        endpointId,
        PLATFORM_WALLET_ADDRESS,
        pricing.developer_wallet_address, // DEVELOPER receives
        pricing.price_per_call_eth
      );

      return {
        success: false,
        status_code: 402,
        message:
          "💰 Payment Required - This tool costs " +
          pricing.price_per_call_eth +
          " ETH per call",
        payment_details: {
          payment_id: payment.payment_id,
          amount_eth: pricing.price_per_call_eth,
          developer_wallet: pricing.developer_wallet_address,
          your_balance: currentBalance.toString(),
          sufficient_balance: currentBalance >= requiredAmount,
          step_1:
            currentBalance >= requiredAmount
              ? `Call: approve_payment(payment_id: "${payment.payment_id}")`
              : `Insufficient balance. Need ${(requiredAmount - currentBalance).toFixed(6)} ETH more. Call get_deposit_address to fund account.`,
          step_2:
            currentBalance >= requiredAmount
              ? `After approval, retry this SAME tool call but ADD this parameter: _payment_id: "${payment.payment_id}"`
              : "After funding, call approve_payment, then retry with _payment_id",
          warning:
            "⚠️ If you retry without _payment_id, you'll be charged AGAIN!",
        },
      };
    } catch (error: any) {
      this.logger.error(`Payment check error: ${error.message}`, error);
      return {
        success: false,
        status_code: 500,
        message: `Payment verification error: ${error.message}`,
      };
    }
  }

  /**
   * Call the actual API endpoint with the provided arguments
   * This is the equivalent of _call_api_endpoint from Python
   *
   * @param endpointName - Name of the endpoint to call
   * @param args - Arguments to pass to the API endpoint
   * @param endUserId - Optional end user ID (who pays for the tool)
   * @param developerId - Optional developer ID (who receives the payment)
   * @returns Dict containing success status, data, and message
   */
  async callApiEndpoint(
    endpointName: string,
    args: Record<string, any>,
    endUserId?: string,
    developerId?: string
  ): Promise<ApiResponse> {
    if (!this.endpoints.has(endpointName)) {
      this.logger.error(`Endpoint '${endpointName}' not found`);
      return {
        success: false,
        message: `Endpoint '${endpointName}' not found`,
      };
    }

    const endpoint = this.endpoints.get(endpointName)!;
    this.logger.info(`Calling ${endpoint.method} ${endpoint.url}`, { args });

    // DEBUG: Log all received parameters including _payment_id
    this.logger.info(
      `[DEBUG] Tool parameters received: ${JSON.stringify(args)}`
    );
    if (args._payment_id) {
      this.logger.info(`[DEBUG] ✓ _payment_id present: ${args._payment_id}`);
    } else {
      this.logger.warning(`[DEBUG] ⚠️ _payment_id NOT present in parameters!`);
    }

    try {
      // Check if payment is required for this endpoint
      if (endpoint.id && endUserId && developerId) {
        const paymentCheckResult = await this.checkPaymentRequired(
          endpoint.id,
          endUserId, // End user who pays
          developerId, // Developer who receives
          args
        );

        if (paymentCheckResult) {
          // Payment required but not satisfied - return 402
          return paymentCheckResult;
        }
        // Payment verified or not required - continue with API call
      }

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

      // Make HTTP request using IHttpClient
      let response;

      if (endpoint.method === HTTPMethod.GET) {
        response = await this.httpClient.get(url, {
          params: requestArgs,
          headers,
          timeout,
        });
      } else if (endpoint.method === HTTPMethod.POST) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
        response = await this.httpClient.post(url, args, {
          headers,
          timeout,
        });
      } else if (endpoint.method === HTTPMethod.PUT) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
        response = await this.httpClient.put(url, args, {
          headers,
          timeout,
        });
      } else if (endpoint.method === HTTPMethod.PATCH) {
        headers["Content-Type"] = headers["Content-Type"] || "application/json";
        response = await this.httpClient.patch(url, args, {
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
        this.logger.error(errorMsg, error);
        return {
          success: false,
          message: errorMsg,
        };
      }

      this.logger.error(
        `Error calling endpoint '${endpointName}': ${error.message}`,
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
   * @param response - HTTP response object
   * @param endpointName - Name of the endpoint that was called
   * @returns Dict containing success status, data, and message
   */
  private async processResponse(
    response: {
      data: any;
      status: number;
      statusText: string;
      headers: Record<string, string>;
    },
    endpointName: string
  ): Promise<ApiResponse> {
    try {
      const data = response.data;
      const statusCode = response.status;

      if (statusCode >= 200 && statusCode < 300) {
        this.logger.info(
          `API call successful: ${endpointName} returned ${statusCode}`
        );
        return {
          success: true,
          status_code: statusCode,
          data: data,
          message: `Successfully called ${endpointName}`,
        };
      } else {
        this.logger.warning(
          `API call failed: ${endpointName} returned ${statusCode}`
        );
        return {
          success: false,
          status_code: statusCode,
          data: data,
          message: `API call failed with status ${statusCode}`,
        };
      }
    } catch (error: any) {
      this.logger.error(
        `Error processing response from ${endpointName}: ${error.message}`,
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
      this.logger.info(`Removed endpoint '${endpointName}'`);
    } else {
      this.logger.warning(`Endpoint '${endpointName}' not found for removal`);
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
