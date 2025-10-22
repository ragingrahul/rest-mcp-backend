/**
 * Payment Routes
 * API endpoints for payment system (single platform wallet)
 */

import { Router } from "express";
import { verifyToken as authMiddleware } from "../middleware/auth.middleware.js";
import {
  getBalance,
  getDepositInstructions,
  creditDeposit,
  manualCredit,
  setPricing,
  getPricing,
  removePricing,
  getPaymentHistory,
  checkPaymentStatus,
} from "../controllers/paymentController.js";

const router = Router();

// ==================== Balance & Wallet Routes ====================

/**
 * GET /api/balance
 * Get user's balance (internal accounting)
 */
router.get("/balance", authMiddleware, getBalance);

/**
 * GET /api/deposit
 * Get deposit instructions (platform wallet address)
 */
router.get("/deposit", authMiddleware, getDepositInstructions);

/**
 * POST /api/deposit/credit
 * Credit user balance after deposit (with tx verification)
 */
router.post("/deposit/credit", authMiddleware, creditDeposit);

/**
 * POST /api/deposit/manual
 * Manual credit (for testing/admin)
 */
router.post("/deposit/manual", authMiddleware, manualCredit);

// ==================== Pricing Routes ====================

/**
 * POST /api/pricing/endpoint/:endpointId
 * Set or update pricing for an endpoint (developer only)
 */
router.post("/pricing/endpoint/:endpointId", authMiddleware, setPricing);

/**
 * GET /api/pricing/endpoint/:endpointId
 * Get pricing for an endpoint (public)
 */
router.get("/pricing/endpoint/:endpointId", getPricing);

/**
 * DELETE /api/pricing/endpoint/:endpointId
 * Remove pricing from an endpoint (developer only)
 */
router.delete("/pricing/endpoint/:endpointId", authMiddleware, removePricing);

// ==================== Payment Transaction Routes ====================

/**
 * GET /api/payments/history
 * Get payment transaction history for authenticated user
 */
router.get("/payments/history", authMiddleware, getPaymentHistory);

/**
 * GET /api/payments/status/:paymentId
 * Check status of a specific payment
 */
router.get("/payments/status/:paymentId", authMiddleware, checkPaymentStatus);

export default router;
