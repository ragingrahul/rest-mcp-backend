/**
 * Endpoint Repository Service
 * Handles all Supabase database operations for endpoints
 */

import { supabase, getSupabaseWithAuth } from "./supabase.js";
import {
  APIEndpoint,
  CreateEndpointInput,
  UpdateEndpointInput,
} from "../types/api.types.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";

// Get logger for this service
const log = LoggerFactory.getLogger("EndpointRepository");

/**
 * Convert database record to APIEndpoint
 */
function toAPIEndpoint(record: any): APIEndpoint {
  const endpoint: APIEndpoint = {
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

  // Add pricing fields if available
  if (record.endpoint_pricing) {
    endpoint.price_per_call_eth = record.endpoint_pricing.price_per_call_eth;
    endpoint.developer_wallet_address =
      record.endpoint_pricing.developer_wallet_address;
    endpoint.requires_payment =
      parseFloat(record.endpoint_pricing.price_per_call_eth) > 0;
    // Also set is_paid for frontend compatibility
    (endpoint as any).is_paid =
      !!record.endpoint_pricing &&
      parseFloat(record.endpoint_pricing.price_per_call_eth) > 0;
  } else {
    // Explicitly set to false/null when no pricing
    endpoint.requires_payment = false;
    (endpoint as any).is_paid = false;
  }

  return endpoint;
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

  // Separate endpoint updates from pricing updates
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

  // Update endpoint table if there are non-pricing updates
  if (Object.keys(updateData).length > 0) {
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
  }

  // Handle pricing updates separately
  const hasPricingUpdate =
    updates.price_per_call_eth !== undefined ||
    updates.developer_wallet_address !== undefined ||
    (updates as any).is_paid !== undefined;

  if (hasPricingUpdate) {
    const isPaid = (updates as any).is_paid;

    if (isPaid === false) {
      // Remove pricing if is_paid is explicitly set to false
      const { error: deleteError } = await client
        .from("endpoint_pricing")
        .delete()
        .eq("endpoint_id", endpointId);

      if (deleteError) {
        log.warning(
          `Failed to delete pricing: ${deleteError.message}`,
          deleteError
        );
      }
    } else if (
      updates.price_per_call_eth !== undefined &&
      updates.developer_wallet_address !== undefined
    ) {
      // Upsert pricing
      const pricingData = {
        endpoint_id: endpointId,
        price_per_call_eth: updates.price_per_call_eth,
        developer_wallet_address: updates.developer_wallet_address,
      };

      const { error: pricingError } = await client
        .from("endpoint_pricing")
        .upsert(pricingData, {
          onConflict: "endpoint_id",
        });

      if (pricingError) {
        log.error(
          `Failed to update pricing: ${pricingError.message}`,
          pricingError
        );
        throw new Error(`Failed to update pricing: ${pricingError.message}`);
      }
    }
  }

  // Fetch the updated endpoint with pricing
  const { data: updatedEndpoint, error: fetchError } = await client
    .from("endpoints")
    .select(
      `
      *,
      endpoint_pricing (
        price_per_call_eth,
        developer_wallet_address
      )
    `
    )
    .eq("id", endpointId)
    .eq("user_id", userId)
    .single();

  if (fetchError) {
    log.error(
      `Failed to fetch updated endpoint: ${fetchError.message}`,
      fetchError
    );
    throw new Error(`Failed to fetch updated endpoint: ${fetchError.message}`);
  }

  if (!updatedEndpoint) {
    throw new Error("Endpoint not found or access denied");
  }

  log.info(`Updated endpoint ${endpointId}`);
  return toAPIEndpoint(updatedEndpoint);
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
 * Includes pricing information via LEFT JOIN
 */
export async function getEndpointsByUserId(
  userId: string,
  accessToken?: string
): Promise<APIEndpoint[]> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { data, error } = await client
    .from("endpoints")
    .select(
      `
      *,
      endpoint_pricing (
        price_per_call_eth,
        developer_wallet_address
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    log.error(`Failed to fetch endpoints: ${error.message}`, error);
    throw new Error(`Failed to fetch endpoints: ${error.message}`);
  }

  return data.map(toAPIEndpoint);
}

/**
 * Get all endpoints for a user (public read via RLS)
 * Uses anon key with public SELECT policy - no auth needed for reading
 * This is used for server initialization to load endpoints for MCP servers
 * Includes pricing information via LEFT JOIN
 */
export async function getEndpointsByUserIdServerSide(
  userId: string
): Promise<APIEndpoint[]> {
  // Use anon client - RLS allows public SELECT on endpoints (marketplace model)
  const { data, error } = await supabase
    .from("endpoints")
    .select(
      `
      *,
      endpoint_pricing (
        price_per_call_eth,
        developer_wallet_address
      )
    `
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    log.error(
      `Failed to fetch endpoints for user ${userId}: ${error.message}`,
      error
    );
    throw new Error(`Failed to fetch endpoints: ${error.message}`);
  }

  return data.map(toAPIEndpoint);
}

/**
 * Get a specific endpoint by name for a user
 * Includes pricing information via LEFT JOIN
 */
export async function getEndpointByName(
  userId: string,
  name: string,
  accessToken?: string
): Promise<APIEndpoint | null> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { data, error } = await client
    .from("endpoints")
    .select(
      `
      *,
      endpoint_pricing (
        price_per_call_eth,
        developer_wallet_address
      )
    `
    )
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
 * Includes pricing information via LEFT JOIN
 */
export async function getEndpointById(
  userId: string,
  endpointId: string,
  accessToken?: string
): Promise<APIEndpoint | null> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabase;

  const { data, error } = await client
    .from("endpoints")
    .select(
      `
      *,
      endpoint_pricing (
        price_per_call_eth,
        developer_wallet_address
      )
    `
    )
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
 * Uses anon key with public SELECT policy - marketplace model allows public read
 */
export async function getAllUsersWithEndpoints(): Promise<string[]> {
  // Use anon client - RLS allows public SELECT on endpoints (marketplace model)
  const { data, error } = await supabase
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
