/**
 * Health Controller
 * Handles health check endpoint
 */

import { Request, Response } from "express";

/**
 * Health check endpoint
 */
export async function healthCheck(_req: Request, res: Response): Promise<void> {
  res.json({
    status: "healthy",
    server: "mcp-marketplace-server",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
