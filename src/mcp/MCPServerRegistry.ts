/**
 * MCP Server Registry
 * Manages multiple MCP server instances (one per developer)
 */

import { DynamicMCPServer } from "./DynamicMCPServer.js";
import { getEndpointsByUserIdServerSide } from "../services/endpointRepository.js";
import { supabase } from "../services/supabase.js";
import { IMCPServerRegistry } from "../types/mcp.types.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";

// Get logger for this service
const log = LoggerFactory.getLogger("MCPServerRegistry");

/**
 * Registry to manage per-user MCP server instances
 * Each developer gets their own DynamicMCPServer with only their endpoints
 */
export class MCPServerRegistry implements IMCPServerRegistry {
  private servers: Map<string, DynamicMCPServer>;
  private usernameToUserId: Map<string, string>;

  constructor() {
    this.servers = new Map();
    this.usernameToUserId = new Map();
    log.info("Initialized MCP server registry");
  }

  /**
   * Get or create a server instance for a specific user
   */
  async getOrCreateServer(userId: string): Promise<DynamicMCPServer> {
    // Check if server already exists
    if (this.servers.has(userId)) {
      return this.servers.get(userId)!;
    }

    // Create new server instance for this user
    log.info(`Creating new MCP server for user ${userId}`);
    const server = new DynamicMCPServer();

    // Load user's endpoints from Supabase (using service role key)
    try {
      const endpoints = await getEndpointsByUserIdServerSide(userId);
      log.info(`Loaded ${endpoints.length} endpoints for user ${userId}`);

      // Add each endpoint to the server
      for (const endpoint of endpoints) {
        server.addEndpoint(endpoint);
      }

      // Store the server instance
      this.servers.set(userId, server);

      return server;
    } catch (error: any) {
      log.error(
        `Failed to create server for user ${userId}: ${error.message}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get server by user ID (returns null if doesn't exist)
   */
  getServerByUserId(userId: string): DynamicMCPServer | null {
    return this.servers.get(userId) || null;
  }

  /**
   * Get server by username (resolves username to userId first)
   */
  async getServerByUsername(
    username: string
  ): Promise<DynamicMCPServer | null> {
    // Check cache first
    if (this.usernameToUserId.has(username)) {
      const userId = this.usernameToUserId.get(username)!;
      return this.getServerByUserId(userId);
    }

    // Query Supabase to resolve username to userId
    try {
      // Try to get user by email first (common case)
      const { data: userData, error: userError } = await supabase
        .from("auth.users")
        .select("id")
        .eq("email", username)
        .single();

      if (!userError && userData) {
        const userId = userData.id;
        this.usernameToUserId.set(username, userId);
        return this.getServerByUserId(userId);
      }

      // If email doesn't work, try user_metadata
      // Note: This requires a custom query or storing username separately
      // For now, we'll return null if email lookup fails
      log.warning(`Could not resolve username '${username}' to userId`);
      return null;
    } catch (error: any) {
      log.error(`Error resolving username: ${error.message}`, error);
      return null;
    }
  }

  /**
   * Remove a server instance (e.g., when user deletes all endpoints)
   */
  removeServer(userId: string): boolean {
    const existed = this.servers.delete(userId);

    if (existed) {
      log.info(`Removed MCP server for user ${userId}`);
    }

    // Also clear username cache entries for this userId
    for (const [username, cachedUserId] of this.usernameToUserId.entries()) {
      if (cachedUserId === userId) {
        this.usernameToUserId.delete(username);
      }
    }

    return existed;
  }

  /**
   * Reload endpoints for a user's server from Supabase
   */
  async reloadServerEndpoints(userId: string): Promise<void> {
    log.info(`Reloading endpoints for user ${userId}'s server`);

    // Remove existing server
    this.removeServer(userId);

    // Create fresh server with updated endpoints
    await this.getOrCreateServer(userId);
  }

  /**
   * Check if a server exists for a user
   */
  hasServer(userId: string): boolean {
    return this.servers.has(userId);
  }

  /**
   * Get total number of active servers
   */
  getServerCount(): number {
    return this.servers.size;
  }

  /**
   * Get all active user IDs with servers
   */
  getActiveUserIds(): string[] {
    return Array.from(this.servers.keys());
  }

  /**
   * Initialize servers for all users with endpoints (called on startup)
   */
  async initializeAllServers(userIds: string[]): Promise<void> {
    log.info(`Initializing servers for ${userIds.length} users`);

    const initPromises = userIds.map((userId) =>
      this.getOrCreateServer(userId).catch((error) => {
        log.error(
          `Failed to initialize server for user ${userId}: ${error.message}`,
          error
        );
        // Continue with other users even if one fails
      })
    );

    await Promise.all(initPromises);

    log.info(`Initialized ${this.servers.size} MCP servers`);
  }

  /**
   * Clear username cache (useful for testing or after user updates)
   */
  clearUsernameCache(): void {
    this.usernameToUserId.clear();
    log.info("Cleared username cache");
  }
}
