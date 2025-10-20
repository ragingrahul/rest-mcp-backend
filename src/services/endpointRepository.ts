/**
 * Endpoint Repository Service
 * Handles all Supabase database operations for endpoints
 */

import { supabase, getSupabaseWithAuth } from "./supabase.js";
import { createClient } from "@supabase/supabase-js";
import {
  APIEndpoint,
  EndpointRecord,
  CreateEndpointInput,
  UpdateEndpointInput,
} from "../types/api.types.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";

// Get logger for this service
const log = LoggerFactory.getLogger("EndpointRepository");

/**
 * Convert database record to APIEndpoint
 */
function toAPIEndpoint(record: EndpointRecord): APIEndpoint {
  return {
    id: record.id,
    user_id: record.user_id,
    name: record.name,
    url: record.url,
    method: record.method as any,
    description: record.description,
    parameters: record.parameters,
    headers: record.headers,
    timeout: record.timeout,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/**
 * Create a new endpoint for a user
 */
export async function createEndpoint(
  userId: string,
  endpoint: CreateEndpointInput,
  accessToken?: string
): Promise<APIEndpoint> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { data, error } = await client
    .from("endpoints")
    .insert({
      user_id: userId,
      name: endpoint.name,
      url: endpoint.url,
      method: endpoint.method,
      description: endpoint.description,
      parameters: endpoint.parameters,
      headers: endpoint.headers || null,
      timeout: endpoint.timeout || 30,
    })
    .select()
    .single();

  if (error) {
    log.error(`Failed to create endpoint: ${error.message}`, error);
    throw new Error(`Failed to create endpoint: ${error.message}`);
  }

  log.info(`Created endpoint '${endpoint.name}' for user ${userId}`);
  return toAPIEndpoint(data);
}

/**
 * Update an existing endpoint
 */
export async function updateEndpoint(
  userId: string,
  endpointId: string,
  updates: UpdateEndpointInput,
  accessToken?: string
): Promise<APIEndpoint> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.url !== undefined) updateData.url = updates.url;
  if (updates.method !== undefined) updateData.method = updates.method;
  if (updates.description !== undefined)
    updateData.description = updates.description;
  if (updates.parameters !== undefined)
    updateData.parameters = updates.parameters;
  if (updates.headers !== undefined) updateData.headers = updates.headers;
  if (updates.timeout !== undefined) updateData.timeout = updates.timeout;

  const { data, error } = await client
    .from("endpoints")
    .update(updateData)
    .eq("id", endpointId)
    .eq("user_id", userId) // Ensure user owns the endpoint
    .select()
    .single();

  if (error) {
    log.error(`Failed to update endpoint: ${error.message}`, error);
    throw new Error(`Failed to update endpoint: ${error.message}`);
  }

  if (!data) {
    throw new Error("Endpoint not found or access denied");
  }

  log.info(`Updated endpoint ${endpointId}`);
  return toAPIEndpoint(data);
}

/**
 * Delete an endpoint
 */
export async function deleteEndpoint(
  userId: string,
  endpointId: string,
  accessToken?: string
): Promise<boolean> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { error } = await client
    .from("endpoints")
    .delete()
    .eq("id", endpointId)
    .eq("user_id", userId); // Ensure user owns the endpoint

  if (error) {
    log.error(`Failed to delete endpoint: ${error.message}`, error);
    throw new Error(`Failed to delete endpoint: ${error.message}`);
  }

  log.info(`Deleted endpoint ${endpointId}`);
  return true;
}

/**
 * Delete an endpoint by name
 */
export async function deleteEndpointByName(
  userId: string,
  endpointName: string,
  accessToken?: string
): Promise<boolean> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { error, count } = await client
    .from("endpoints")
    .delete()
    .eq("name", endpointName)
    .eq("user_id", userId);

  if (error) {
    log.error(`Failed to delete endpoint by name: ${error.message}`, error);
    throw new Error(`Failed to delete endpoint: ${error.message}`);
  }

  if (count === 0) {
    return false; // Endpoint not found
  }

  log.info(`Deleted endpoint '${endpointName}'`);
  return true;
}

/**
 * Get all endpoints for a user (client-side with auth token)
 */
export async function getEndpointsByUserId(
  userId: string,
  accessToken?: string
): Promise<APIEndpoint[]> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { data, error } = await client
    .from("endpoints")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    log.error(`Failed to fetch endpoints: ${error.message}`, error);
    throw new Error(`Failed to fetch endpoints: ${error.message}`);
  }

  return data.map(toAPIEndpoint);
}

/**
 * Get all endpoints for a user (server-side with service role key)
 * This bypasses RLS and is used for server initialization
 */
export async function getEndpointsByUserIdServerSide(
  userId: string
): Promise<APIEndpoint[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const errorMsg =
      "Service role key not configured for server-side operations";
    log.error(errorMsg);
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for server-side endpoint loading"
    );
  }

  // Create client with service role key (bypasses RLS)
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await serviceClient
    .from("endpoints")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    log.error(
      `Failed to fetch endpoints (server-side): ${error.message}`,
      error
    );
    throw new Error(`Failed to fetch endpoints: ${error.message}`);
  }

  return data.map(toAPIEndpoint);
}

/**
 * Get a specific endpoint by name for a user
 */
export async function getEndpointByName(
  userId: string,
  name: string,
  accessToken?: string
): Promise<APIEndpoint | null> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { data, error } = await client
    .from("endpoints")
    .select("*")
    .eq("user_id", userId)
    .eq("name", name)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    log.error(`Failed to fetch endpoint: ${error.message}`, error);
    throw new Error(`Failed to fetch endpoint: ${error.message}`);
  }

  return toAPIEndpoint(data);
}

/**
 * Get a specific endpoint by ID
 */
export async function getEndpointById(
  userId: string,
  endpointId: string,
  accessToken?: string
): Promise<APIEndpoint | null> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { data, error } = await client
    .from("endpoints")
    .select("*")
    .eq("id", endpointId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    log.error(`Failed to fetch endpoint: ${error.message}`, error);
    throw new Error(`Failed to fetch endpoint: ${error.message}`);
  }

  return toAPIEndpoint(data);
}

/**
 * Get count of endpoints for a user
 */
export async function getEndpointCount(
  userId: string,
  accessToken?: string
): Promise<number> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { count, error } = await client
    .from("endpoints")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    log.error(`Failed to count endpoints: ${error.message}`, error);
    throw new Error(`Failed to count endpoints: ${error.message}`);
  }

  return count || 0;
}

/**
 * Get all users who have endpoints (for server initialization)
 * Uses service role key to bypass RLS
 */
export async function getAllUsersWithEndpoints(): Promise<string[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    const errorMsg = "Service role key not configured for getting all users";
    log.error(errorMsg);
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for server initialization"
    );
  }

  // Create client with service role key (bypasses RLS)
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await serviceClient
    .from("endpoints")
    .select("user_id")
    .order("user_id");

  if (error) {
    log.error(`Failed to fetch users with endpoints: ${error.message}`, error);
    throw new Error(`Failed to fetch users: ${error.message}`);
  }

  // Get unique user IDs
  const uniqueUserIds = [...new Set(data.map((row) => row.user_id))];
  return uniqueUserIds;
}
