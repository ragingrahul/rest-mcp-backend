/**
 * Authentication Controller
 * Handles all authentication-related business logic
 */

import { Request, Response } from "express";
import { supabase } from "../services/supabase.js";
import {
  AuthenticatedRequest,
  SignupRequest,
  LoginRequest,
  AuthUser,
} from "../types/auth.types.js";

// Configure logging
const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warning: (message: string) => console.warn(`[WARNING] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

/**
 * Convert Supabase User to AuthUser
 */
function toAuthUser(user: any): AuthUser {
  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
    app_metadata: user.app_metadata,
  };
}

/**
 * User signup/registration
 */
export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, metadata }: SignupRequest = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
      return;
    }

    // Create user in Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata || {},
      },
    });

    if (error) {
      log.error(`[AuthController] Signup error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (!data.user) {
      res.status(500).json({
        success: false,
        message: "Failed to create user",
      });
      return;
    }

    log.info(`[AuthController] User registered: ${email}`);

    res.status(201).json({
      success: true,
      message:
        "User registered successfully. Please check your email for verification.",
      user: toAuthUser(data.user),
      access_token: data.session?.access_token,
      refresh_token: data.session?.refresh_token,
    });
  } catch (error: any) {
    log.error(`[AuthController] Signup error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error during signup",
    });
  }
}

/**
 * User login
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validate input
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
      return;
    }

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      log.warning(
        `[AuthController] Login failed for ${email}: ${error.message}`
      );
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    if (!data.user || !data.session) {
      res.status(401).json({
        success: false,
        message: "Authentication failed",
      });
      return;
    }

    log.info(`[AuthController] User logged in: ${email}`);

    res.json({
      success: true,
      message: "Login successful",
      user: toAuthUser(data.user),
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (error: any) {
    log.error(`[AuthController] Login error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error during login",
    });
  }
}

/**
 * User logout
 * Note: This primarily invalidates the session on the client side
 * The server is stateless, so token validation will fail after expiry
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;

    if (authReq.user) {
      log.info(`[AuthController] User logged out: ${authReq.user.email}`);
    }

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error: any) {
    log.error(`[AuthController] Logout error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error during logout",
    });
  }
}

/**
 * Get current user profile
 */
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
      return;
    }

    // Get base URL for MCP connection
    const baseUrl =
      process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;

    const userId = authReq.user.id;
    const userEmail = authReq.user.email;

    res.json({
      success: true,
      user: toAuthUser(authReq.user),
      mcp_connection: {
        url_by_id: `${baseUrl}/mcp/${userId}`,
        url_by_username: userEmail
          ? `${baseUrl}/mcp/u/${userEmail.split("@")[0]}`
          : undefined,
      },
    });
  } catch (error: any) {
    log.error(`[AuthController] Get profile error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error retrieving profile",
    });
  }
}

/**
 * Refresh access token
 */
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({
        success: false,
        message: "Refresh token is required",
      });
      return;
    }

    // Refresh the session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error || !data.session) {
      log.warning(`[AuthController] Token refresh failed: ${error?.message}`);
      res.status(401).json({
        success: false,
        message: "Invalid or expired refresh token",
      });
      return;
    }

    log.info(`[AuthController] Token refreshed for user: ${data.user?.email}`);

    res.json({
      success: true,
      message: "Token refreshed successfully",
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: data.user ? toAuthUser(data.user) : undefined,
    });
  } catch (error: any) {
    log.error(`[AuthController] Token refresh error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error refreshing token",
    });
  }
}
