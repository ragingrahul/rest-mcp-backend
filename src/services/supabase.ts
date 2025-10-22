/**
 * Supabase Client Service
 * Initializes and exports the Supabase client for authentication
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file"
  );
}

if (!supabaseServiceRoleKey) {
  console.warn(
    "[WARNING] SUPABASE_SERVICE_ROLE_KEY not set. Server-side operations may fail due to RLS restrictions."
  );
}

/**
 * Supabase client instance
 * Used for authentication and database operations
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Server-side, no session persistence needed
      detectSessionInUrl: false,
    },
  }
);

/**
 * Supabase admin client with service role (bypasses RLS)
 * Use ONLY for server-side operations that need to bypass RLS
 * NEVER expose this client or key to the frontend!
 *
 * This is used by:
 * - MCP payment tools (server-side, no user auth context)
 * - Balance management (creating/updating balances)
 * - Payment processing (creating payment records)
 */
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl!,
  supabaseServiceRoleKey || supabaseAnonKey!, // Fallback to anon key if service key not set
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Get a Supabase client with a specific access token
 * Useful for making authenticated requests on behalf of a user
 */
export function getSupabaseWithAuth(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase credentials not initialized");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
