/**
 * Authentication Routes
 * Defines all authentication-related routes
 */

import express, { Router } from "express";
import {
  signup,
  login,
  logout,
  getProfile,
  refreshToken,
} from "../controllers/authController.js";
import { verifyToken } from "../middleware/auth.middleware.js";

/**
 * Create and configure authentication routes
 *
 * @returns Configured Express Router
 */
export function createAuthRoutes(): Router {
  const router = express.Router();

  // Public routes (no authentication required)
  // POST /api/auth/signup - Register a new user
  router.post("/signup", signup);

  // POST /api/auth/login - Login user
  router.post("/login", login);

  // POST /api/auth/refresh - Refresh access token
  router.post("/refresh", refreshToken);

  // Protected routes (authentication required)
  // GET /api/auth/profile - Get current user profile
  router.get("/profile", verifyToken, getProfile);

  // POST /api/auth/logout - Logout user
  router.post("/logout", verifyToken, logout);

  return router;
}
