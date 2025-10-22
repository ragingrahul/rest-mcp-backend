/**
 * Pricing Repository Service
 * Handles database operations for endpoint pricing
 */

import { supabase, supabaseAdmin, getSupabaseWithAuth } from "./supabase.js";
import {
  EndpointPricing,
  CreatePricingInput,
  UpdatePricingInput,
} from "../types/payment.types.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";

const log = LoggerFactory.getLogger("PricingRepository");

/**
 * Create pricing for an endpoint
 */
export async function createPricing(
  input: CreatePricingInput,
  accessToken?: string
): Promise<EndpointPricing> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const { data, error } = await client
    .from("endpoint_pricing")
    .insert({
      endpoint_id: input.endpoint_id,
      price_per_call_eth: input.price_per_call_eth,
      developer_wallet_address: input.developer_wallet_address,
    })
    .select()
    .single();

  if (error) {
    log.error(`Failed to create pricing: ${error.message}`, error);
    throw new Error(`Failed to create pricing: ${error.message}`);
  }

  log.info(`Created pricing for endpoint ${input.endpoint_id}`);
  return data;
}

/**
 * Update pricing for an endpoint
 */
export async function updatePricing(
  endpointId: string,
  updates: UpdatePricingInput,
  accessToken?: string
): Promise<EndpointPricing> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const updateData: any = {};
  if (updates.price_per_call_eth !== undefined)
    updateData.price_per_call_eth = updates.price_per_call_eth;
  if (updates.developer_wallet_address !== undefined)
    updateData.developer_wallet_address = updates.developer_wallet_address;

  const { data, error } = await client
    .from("endpoint_pricing")
    .update(updateData)
    .eq("endpoint_id", endpointId)
    .select()
    .single();

  if (error) {
    log.error(`Failed to update pricing: ${error.message}`, error);
    throw new Error(`Failed to update pricing: ${error.message}`);
  }

  if (!data) {
    throw new Error("Pricing not found");
  }

  log.info(`Updated pricing for endpoint ${endpointId}`);
  return data;
}

/**
 * Delete pricing for an endpoint
 */
export async function deletePricing(
  endpointId: string,
  accessToken?: string
): Promise<boolean> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const { error } = await client
    .from("endpoint_pricing")
    .delete()
    .eq("endpoint_id", endpointId);

  if (error) {
    log.error(`Failed to delete pricing: ${error.message}`, error);
    throw new Error(`Failed to delete pricing: ${error.message}`);
  }

  log.info(`Deleted pricing for endpoint ${endpointId}`);
  return true;
}

/**
 * Get pricing by endpoint ID
 */
export async function getPricingByEndpointId(
  endpointId: string
): Promise<EndpointPricing | null> {
  const { data, error } = await supabase
    .from("endpoint_pricing")
    .select("*")
    .eq("endpoint_id", endpointId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned
      return null;
    }
    log.error(`Failed to fetch pricing: ${error.message}`, error);
    throw new Error(`Failed to fetch pricing: ${error.message}`);
  }

  return data;
}

/**
 * Check if endpoint requires payment
 */
export async function requiresPayment(endpointId: string): Promise<boolean> {
  const pricing = await getPricingByEndpointId(endpointId);
  return pricing !== null && parseFloat(pricing.price_per_call_eth) > 0;
}
