/**
 * Payment Controller
 * Handles payment-related operations with a single platform wallet
 */

import { Request, Response } from "express";
import { AuthenticatedRequest } from "../types/auth.types.js";
import { BaseWalletService } from "../infrastructure/blockchain/BaseWalletService.js";
import { BaseTransactionService } from "../infrastructure/blockchain/BaseTransactionService.js";
import {
  getOrCreateBalance,
  addDeposit,
} from "../services/balanceRepository.js";
import {
  createPricing,
  updatePricing,
  getPricingByEndpointId,
  deletePricing,
} from "../services/pricingRepository.js";
import {
  getPaymentByPaymentId,
  getPaymentsByUserId,
} from "../services/paymentRepository.js";
import { LoggerFactory } from "../infrastructure/logging/LoggerFactory.js";
import { type Address, type Hash } from "viem";

const log = LoggerFactory.getLogger("PaymentController");

// Singleton instances
const walletService = new BaseWalletService();
const transactionService = new BaseTransactionService(walletService);

// Get platform wallet address from environment
const PLATFORM_WALLET_ADDRESS =
  process.env.PLATFORM_WALLET_ADDRESS ||
  "0x0000000000000000000000000000000000000000";

/**
 * Get user's balance (internal accounting)
 */
export async function getBalance(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    const balance = await getOrCreateBalance(userId, accessToken);

    res.json({
      success: true,
      balance_eth: balance.balance_eth,
      total_deposited_eth: balance.total_deposited_eth,
      total_spent_eth: balance.total_spent_eth,
      platform_wallet_address: PLATFORM_WALLET_ADDRESS,
    });
  } catch (error: any) {
    log.error(`Error getting balance: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error getting balance: ${error.message}`,
    });
  }
}

/**
 * Get deposit instructions
 */
export async function getDepositInstructions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    res.json({
      success: true,
      platform_wallet_address: PLATFORM_WALLET_ADDRESS,
      chain: walletService.getChainName(),
      chain_id: walletService.getChainId(),
      instructions: {
        step1: `Send ETH to platform wallet: ${PLATFORM_WALLET_ADDRESS}`,
        step2: "Include your user ID in transaction memo/data (optional)",
        step3:
          "Call POST /api/wallet/deposit with transaction hash to credit your balance",
        step4: "Wait for confirmation and check balance",
      },
      deposit_methods: [
        {
          method: "Direct Transfer",
          description: `Send ETH directly to ${PLATFORM_WALLET_ADDRESS} on ${walletService.getChainName()}`,
        },
        {
          method: "Bridge from Ethereum",
          description: "Use Base bridge to transfer ETH from Ethereum mainnet",
          url: "https://bridge.base.org",
        },
        {
          method: "Coinbase",
          description: "Transfer from Coinbase directly to Base network",
        },
      ],
    });
  } catch (error: any) {
    log.error(`Error getting deposit instructions: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error getting deposit instructions: ${error.message}`,
    });
  }
}

/**
 * Credit user balance after deposit
 * User provides transaction hash, we verify and credit their account
 */
export async function creditDeposit(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const { tx_hash, amount_eth } = req.body;

    if (!tx_hash || !amount_eth) {
      res.status(400).json({
        success: false,
        message: "tx_hash and amount_eth are required",
      });
      return;
    }

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    // Verify transaction on blockchain (optional but recommended)
    const verification = await transactionService.verifyPayment({
      txHash: tx_hash as Hash,
      expectedAmount: amount_eth,
      expectedRecipient: PLATFORM_WALLET_ADDRESS as Address,
    });

    if (!verification.isValid) {
      res.status(400).json({
        success: false,
        message: `Transaction verification failed: ${verification.errorMessage}`,
      });
      return;
    }

    // Credit user's balance
    const updatedBalance = await addDeposit(userId, amount_eth, accessToken);

    log.info(`Credited ${amount_eth} ETH to user ${userId} from tx ${tx_hash}`);

    res.json({
      success: true,
      message: "Deposit credited successfully",
      balance: updatedBalance,
      verified_tx_hash: tx_hash,
    });
  } catch (error: any) {
    log.error(`Error crediting deposit: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error crediting deposit: ${error.message}`,
    });
  }
}

/**
 * Manual credit (for admin/testing - should be protected)
 */
export async function manualCredit(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const { amount_eth } = req.body;

    if (!amount_eth) {
      res.status(400).json({
        success: false,
        message: "amount_eth is required",
      });
      return;
    }

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    const updatedBalance = await addDeposit(userId, amount_eth, accessToken);

    log.info(`Manual credit of ${amount_eth} ETH to user ${userId}`);

    res.json({
      success: true,
      message: "Balance credited successfully",
      balance: updatedBalance,
    });
  } catch (error: any) {
    log.error(`Error with manual credit: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error crediting balance: ${error.message}`,
    });
  }
}

/**
 * Set or update pricing for an endpoint (developer only)
 */
export async function setPricing(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const endpointId = req.params.endpointId;
    const { price_per_call_eth, developer_wallet_address } = req.body;

    if (!price_per_call_eth || !developer_wallet_address) {
      res.status(400).json({
        success: false,
        message: "price_per_call_eth and developer_wallet_address are required",
      });
      return;
    }

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    // Check if pricing already exists
    const existing = await getPricingByEndpointId(endpointId);

    let pricing;
    if (existing) {
      pricing = await updatePricing(
        endpointId,
        { price_per_call_eth, developer_wallet_address },
        accessToken
      );
    } else {
      pricing = await createPricing(
        {
          endpoint_id: endpointId,
          price_per_call_eth,
          developer_wallet_address,
        },
        accessToken
      );
    }

    res.json({
      success: true,
      message: "Pricing set successfully",
      pricing,
    });
  } catch (error: any) {
    log.error(`Error setting pricing: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error setting pricing: ${error.message}`,
    });
  }
}

/**
 * Get pricing for an endpoint (public)
 */
export async function getPricing(req: Request, res: Response): Promise<void> {
  try {
    const endpointId = req.params.endpointId;

    const pricing = await getPricingByEndpointId(endpointId);

    if (!pricing) {
      res.status(404).json({
        success: false,
        message: "No pricing set for this endpoint",
      });
      return;
    }

    res.json({
      success: true,
      pricing,
    });
  } catch (error: any) {
    log.error(`Error getting pricing: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error getting pricing: ${error.message}`,
    });
  }
}

/**
 * Delete pricing for an endpoint (developer only)
 */
export async function removePricing(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const endpointId = req.params.endpointId;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    await deletePricing(endpointId, accessToken);

    res.json({
      success: true,
      message: "Pricing removed successfully",
    });
  } catch (error: any) {
    log.error(`Error removing pricing: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error removing pricing: ${error.message}`,
    });
  }
}

/**
 * Get payment transaction history for user
 */
export async function getPaymentHistory(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    const payments = await getPaymentsByUserId(userId, accessToken);

    res.json({
      success: true,
      payments,
      count: payments.length,
    });
  } catch (error: any) {
    log.error(`Error getting payment history: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error getting payment history: ${error.message}`,
    });
  }
}

/**
 * Check payment status
 */
export async function checkPaymentStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
      return;
    }

    const paymentId = req.params.paymentId;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.replace("Bearer ", "");

    const payment = await getPaymentByPaymentId(paymentId, accessToken);

    if (!payment) {
      res.status(404).json({
        success: false,
        message: "Payment not found",
      });
      return;
    }

    if (payment.user_id !== userId) {
      res.status(403).json({
        success: false,
        message: "Unauthorized to view this payment",
      });
      return;
    }

    // If payment has a tx_hash, check blockchain status
    let blockchainStatus;
    if (payment.blockchain_tx_hash) {
      blockchainStatus = await transactionService.getTransactionStatus(
        payment.blockchain_tx_hash as Hash
      );
    }

    res.json({
      success: true,
      payment,
      blockchain_status: blockchainStatus,
    });
  } catch (error: any) {
    log.error(`Error checking payment status: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: `Error checking payment status: ${error.message}`,
    });
  }
}

// Export services for use in other modules
export { walletService, transactionService, PLATFORM_WALLET_ADDRESS };
