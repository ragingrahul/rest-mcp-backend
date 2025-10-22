/**
 * Balance Repository Service
 * Handles database operations for user balances (internal accounting)
 */

import { supabaseAdmin, getSupabaseWithAuth } from "./supabase.js";
import { UserBalance } from "../types/payment.types.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";

const log = LoggerFactory.getLogger("BalanceRepository");

/**
 * Get or create balance record for a user
 */
export async function getOrCreateBalance(
  userId: string,
  accessToken?: string
): Promise<UserBalance> {
  // Use admin client for server-side operations (bypasses RLS)
  // Use authenticated client when accessToken is provided (REST API calls)
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  // Try to get existing balance
  const { data: existing, error: fetchError } = await client
    .from("user_balances")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing && !fetchError) {
    return existing;
  }

  // Create new balance record
  const { data, error } = await client
    .from("user_balances")
    .insert({
      user_id: userId,
      balance_eth: "0",
      total_deposited_eth: "0",
      total_spent_eth: "0",
    })
    .select()
    .single();

  if (error) {
    log.error(`Failed to create balance: ${error.message}`, error);
    throw new Error(`Failed to create balance: ${error.message}`);
  }

  log.info(`Created balance record for user ${userId}`);
  return data;
}

/**
 * Get balance by user ID
 */
export async function getBalanceByUserId(
  userId: string,
  accessToken?: string
): Promise<UserBalance | null> {
  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const { data, error } = await client
    .from("user_balances")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    log.error(`Failed to fetch balance: ${error.message}`, error);
    throw new Error(`Failed to fetch balance: ${error.message}`);
  }

  return data;
}

/**
 * Add deposit to user balance
 */
export async function addDeposit(
  userId: string,
  amountEth: string,
  accessToken?: string
): Promise<UserBalance> {
  const balance = await getOrCreateBalance(userId, accessToken);

  const newBalance = (
    parseFloat(balance.balance_eth) + parseFloat(amountEth)
  ).toString();
  const newTotalDeposited = (
    parseFloat(balance.total_deposited_eth) + parseFloat(amountEth)
  ).toString();

  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const { data, error } = await client
    .from("user_balances")
    .update({
      balance_eth: newBalance,
      total_deposited_eth: newTotalDeposited,
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    log.error(`Failed to add deposit: ${error.message}`, error);
    throw new Error(`Failed to add deposit: ${error.message}`);
  }

  log.info(`Added deposit of ${amountEth} ETH to user ${userId}`);
  return data!;
}

/**
 * Deduct payment from user balance
 */
export async function deductPayment(
  userId: string,
  amountEth: string,
  accessToken?: string
): Promise<UserBalance> {
  const balance = await getBalanceByUserId(userId, accessToken);

  if (!balance) {
    throw new Error("Balance not found");
  }

  const currentBalance = parseFloat(balance.balance_eth);
  const paymentAmount = parseFloat(amountEth);

  if (currentBalance < paymentAmount) {
    throw new Error(
      `Insufficient balance. Required: ${amountEth} ETH, Available: ${currentBalance} ETH`
    );
  }

  const newBalance = (currentBalance - paymentAmount).toString();
  const newTotalSpent = (
    parseFloat(balance.total_spent_eth) + paymentAmount
  ).toString();

  const client = accessToken ? getSupabaseWithAuth(accessToken) : supabaseAdmin;

  const { data, error } = await client
    .from("user_balances")
    .update({
      balance_eth: newBalance,
      total_spent_eth: newTotalSpent,
    })
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    log.error(`Failed to deduct payment: ${error.message}`, error);
    throw new Error(`Failed to deduct payment: ${error.message}`);
  }

  log.info(`Deducted payment of ${amountEth} ETH from user ${userId}`);
  return data!;
}

/**
 * Check if user has sufficient balance
 */
export async function hasSufficientBalance(
  userId: string,
  requiredAmountEth: string,
  accessToken?: string
): Promise<boolean> {
  const balance = await getBalanceByUserId(userId, accessToken);

  if (!balance) {
    return false;
  }

  return parseFloat(balance.balance_eth) >= parseFloat(requiredAmountEth);
}
