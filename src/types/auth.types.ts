/**
 * Authentication type definitions
 */

import { User } from "@supabase/supabase-js";
import { Request } from "express";

export type AuthType = "none" | "apiKey" | "bearer" | "basic";

export interface AuthConfig {
  type: AuthType;
  apiKey?: string;
  apiKeyLocation?: "header" | "query";
  apiKeyName?: string;
  token?: string;
  username?: string;
  password?: string;
}

/**
 * Authenticated user information
 */
export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
}

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * Signup request body
 */
export interface SignupRequest {
  email: string;
  password: string;
  metadata?: Record<string, any>;
}

/**
 * Login request body
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Authentication response
 */
export interface AuthResponse {
  success: boolean;
  message: string;
  user?: AuthUser;
  access_token?: string;
  refresh_token?: string;
}
