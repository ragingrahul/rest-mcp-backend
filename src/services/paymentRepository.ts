/**
 * Payment Repository Service
 * Handles database operations for payment transactions
 */

import { supabaseAdmin, getSupabaseWithAuth } from "./supabase.js";
import { PaymentTransaction, PaymentStatus } from "../types/payment.types.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";
import { randomBytes } from "crypto";

const log = LoggerFactory.getLogger("PaymentRepository");

/**
 * Generate a unique payment ID (pay_xxx format)
 */
export function generatePaymentId(): string {
  return `pay_${randomBytes(16).toString("hex")}`;
}

/**
 * Create a new payment transaction
 */
export async function createPaymentTransaction(
  userId: string,
  endpointId: string,
  platformWallet: string,
  developerWallet: string,
  amountEth: string,
  accessToken?: string
): Promise<PaymentTransaction> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const paymentId = generatePaymentId();

  const { data, error } = await client
    .from("payment_transactions")
    .insert({
      payment_id: paymentId,
      user_id: userId,
      endpoint_id: endpointId,
      from_wallet: platformWallet, // Platform wallet
      to_wallet: developerWallet, // Developer wallet
      amount_eth: amountEth,
      status: PaymentStatus.PENDING,
    })
    .select()
    .single();

  if (error) {
    log.error(`Failed to create payment transaction: ${error.message}`, error);
    throw new Error(`Failed to create payment transaction: ${error.message}`);
  }

  log.info(
    `Created payment transaction: ${paymentId} (${amountEth} ETH from platform to ${developerWallet})`
  );
  return data;
}

/**
 * Get payment transaction by payment_id
 */
export async function getPaymentByPaymentId(
  paymentId: string,
  accessToken?: string
): Promise<PaymentTransaction | null> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const { data, error } = await client
    .from("payment_transactions")
    .select("*")
    .eq("payment_id", paymentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    log.error(`Failed to fetch payment: ${error.message}`, error);
    throw new Error(`Failed to fetch payment: ${error.message}`);
  }

  return data;
}

/**
 * Update payment transaction
 */
export async function updatePaymentTransaction(
  paymentId: string,
  updates: Partial<PaymentTransaction>,
  accessToken?: string
): Promise<PaymentTransaction> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const updateData: any = {};
  if (updates.status) updateData.status = updates.status;
  if (updates.blockchain_tx_hash)
    updateData.blockchain_tx_hash = updates.blockchain_tx_hash;
  if (updates.error_message) updateData.error_message = updates.error_message;
  if (updates.submitted_at) updateData.submitted_at = updates.submitted_at;
  if (updates.completed_at) updateData.completed_at = updates.completed_at;

  const { data, error } = await client
    .from("payment_transactions")
    .update(updateData)
    .eq("payment_id", paymentId)
    .select()
    .single();

  if (error) {
    log.error(`Failed to update payment: ${error.message}`, error);
    throw new Error(`Failed to update payment: ${error.message}`);
  }

  if (!data) {
    throw new Error("Payment not found");
  }

  log.info(`Updated payment transaction: ${paymentId}`);
  return data;
}

/**
 * Mark payment as submitted
 */
export async function markPaymentSubmitted(
  paymentId: string,
  txHash: string,
  accessToken?: string
): Promise<PaymentTransaction> {
  return updatePaymentTransaction(
    paymentId,
    {
      status: PaymentStatus.PROCESSING,
      blockchain_tx_hash: txHash,
      submitted_at: new Date().toISOString(),
    },
    accessToken
  );
}

/**
 * Mark payment as completed
 */
export async function markPaymentCompleted(
  paymentId: string,
  accessToken?: string
): Promise<PaymentTransaction> {
  return updatePaymentTransaction(
    paymentId,
    {
      status: PaymentStatus.COMPLETED,
      completed_at: new Date().toISOString(),
    },
    accessToken
  );
}

/**
 * Mark payment as failed
 */
export async function markPaymentFailed(
  paymentId: string,
  errorMessage: string,
  accessToken?: string
): Promise<PaymentTransaction> {
  return updatePaymentTransaction(
    paymentId,
    {
      status: PaymentStatus.FAILED,
      error_message: errorMessage,
    },
    accessToken
  );
}

/**
 * Get all payments for a user
 */
export async function getPaymentsByUserId(
  userId: string,
  accessToken?: string
): Promise<PaymentTransaction[]> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const { data, error } = await client
    .from("payment_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    log.error(`Failed to fetch payments: ${error.message}`, error);
    throw new Error(`Failed to fetch payments: ${error.message}`);
  }

  return data;
}

/**
 * Get pending payment by user and endpoint
 * Used to check if a pending payment already exists
 */
export async function getPendingPaymentForEndpoint(
  userId: string,
  endpointId: string,
  accessToken?: string
): Promise<PaymentTransaction | null> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const { data, error } = await client
    .from("payment_transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("endpoint_id", endpointId)
    .eq("status", PaymentStatus.PENDING)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    log.error(`Failed to fetch pending payment: ${error.message}`, error);
    throw new Error(`Failed to fetch pending payment: ${error.message}`);
  }

  return data;
}
