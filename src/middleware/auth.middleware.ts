/**
 * Authentication Middleware
 * Verifies access tokens using Supabase
 */

import { Request, Response, NextFunction } from "express";
import { supabase } from "../services/supabase.js";
import { AuthenticatedRequest } from "../types/auth.types.js";

// Configure logging
const log = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warning: (message: string) => console.warn(`[WARNING] ${message}`),
  error: (message: string) => console.error(`[ERROR] ${message}`),
};

/**
 * Middleware to verify JWT access token
 * Extracts token from Authorization header and validates with Supabase
 */
export async function verifyToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: "No authorization header provided",
      });
      return;
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message:
          "Invalid authorization header format. Expected: Bearer <token>",
      });
      return;
    }

    // Extract the token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        success: false,
        message: "No token provided",
      });
      return;
    }

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      log.warning(
        `[AuthMiddleware] Invalid token: ${error?.message || "No user found"}`
      );
      res.status(401).json({
        success: false,
        message: "Invalid or expired token",
      });
      return;
    }

    // Attach user to request object
    (req as AuthenticatedRequest).user = data.user;

    // Continue to next middleware/route handler
    next();
  } catch (error: any) {
    log.error(`[AuthMiddleware] Error verifying token: ${error.message}`);
    res.status(500).json({
      success: false,
      message: "Error verifying authentication",
    });
  }
}

/**
 * Optional middleware - verifies token if present but doesn't fail if missing
 * Useful for endpoints that have different behavior for authenticated users
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      // No token provided, continue without authentication
      next();
      return;
    }

    const token = authHeader.substring(7);

    if (token) {
      const { data } = await supabase.auth.getUser(token);
      if (data.user) {
        (req as AuthenticatedRequest).user = data.user;
      }
    }

    next();
  } catch (error: any) {
    // Log error but don't fail the request
    log.warning(`[AuthMiddleware] Optional auth error: ${error.message}`);
    next();
  }
}
