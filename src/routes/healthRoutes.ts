/**
 * Health Routes
 * Defines health check routes
 */

import express, { Router } from "express";
import { healthCheck } from "../controllers/healthController.js";

/**
 * Create and configure health routes
 *
 * @returns Configured Express Router
 */
export function createHealthRoutes(): Router {
  const router = express.Router();

  // GET /health - Health check
  router.get("/", (req, res) => {
    healthCheck(req, res);
  });

  return router;
}
