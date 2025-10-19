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

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file"
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
