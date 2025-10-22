/**
 * Base Blockchain Transaction Service
 * Handles transaction verification and payment validation
 */

import { type Address, type Hash } from "viem";
import { BaseWalletService } from "./BaseWalletService.js";
import { ILogger } from "../../core/interfaces/ILogger.js";
import { LoggerFactory } from "../logging/LoggerFactory.js";

export interface PaymentVerificationParams {
  txHash: Hash;
  expectedAmount: string; // ETH amount as string
  expectedRecipient: Address;
  expectedSender?: Address;
}

export interface PaymentVerificationResult {
  isValid: boolean;
  actualAmount?: string;
  actualRecipient?: Address;
  actualSender?: Address;
  blockNumber?: bigint;
  timestamp?: bigint;
  errorMessage?: string;
}

export class BaseTransactionService {
  private walletService: BaseWalletService;
  private logger: ILogger;

  constructor(walletService?: BaseWalletService, logger?: ILogger) {
    this.walletService = walletService || new BaseWalletService();
    this.logger = logger || LoggerFactory.getLogger("BaseTransactionService");
  }

  /**
   * Verify that a payment transaction meets the expected criteria
   */
  async verifyPayment(
    params: PaymentVerificationParams
  ): Promise<PaymentVerificationResult> {
    try {
      this.logger.info(`Verifying payment transaction: ${params.txHash}`);

      // Check if transaction is confirmed
      const isConfirmed = await this.walletService.isTransactionConfirmed(
        params.txHash
      );

      if (!isConfirmed) {
        return {
          isValid: false,
          errorMessage: "Transaction not confirmed yet",
        };
      }

      // Get transaction receipt
      const receipt = await this.walletService.getTransactionReceipt(
        params.txHash
      );

      // Verify transaction succeeded
      if (receipt.status !== "success") {
        return {
          isValid: false,
          errorMessage: "Transaction failed on-chain",
        };
      }

      // Get transaction details to verify amount and recipient
      // Note: viem's receipt doesn't include the transaction value directly,
      // so we need to get the full transaction
      const tx = await this.walletService["publicClient"].getTransaction({
        hash: params.txHash,
      });

      // Verify recipient
      if (tx.to?.toLowerCase() !== params.expectedRecipient.toLowerCase()) {
        return {
          isValid: false,
          actualRecipient: tx.to as Address,
          errorMessage: `Wrong recipient. Expected: ${params.expectedRecipient}, Got: ${tx.to}`,
        };
      }

      // Verify amount
      const actualAmountEth = this.walletService.formatWeiToEth(tx.value);
      const expectedAmountWei = this.walletService.parseEthToWei(
        params.expectedAmount
      );
      const actualAmountWei = tx.value;

      if (actualAmountWei < expectedAmountWei) {
        return {
          isValid: false,
          actualAmount: actualAmountEth,
          errorMessage: `Insufficient payment. Expected: ${params.expectedAmount} ETH, Got: ${actualAmountEth} ETH`,
        };
      }

      // Verify sender if provided
      if (params.expectedSender) {
        if (tx.from.toLowerCase() !== params.expectedSender.toLowerCase()) {
          return {
            isValid: false,
            actualSender: tx.from,
            errorMessage: `Wrong sender. Expected: ${params.expectedSender}, Got: ${tx.from}`,
          };
        }
      }

      this.logger.info(
        `Payment verified successfully: ${actualAmountEth} ETH from ${tx.from} to ${tx.to}`
      );

      return {
        isValid: true,
        actualAmount: actualAmountEth,
        actualRecipient: tx.to as Address,
        actualSender: tx.from,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: any) {
      this.logger.error(`Payment verification failed: ${error.message}`, error);
      return {
        isValid: false,
        errorMessage: `Verification error: ${error.message}`,
      };
    }
  }

  /**
   * Execute a payment transfer
   */
  async executePayment(
    fromPrivateKey: string,
    toAddress: Address,
    amountEth: string
  ): Promise<Hash> {
    try {
      const amountWei = this.walletService.parseEthToWei(amountEth);

      const txHash = await this.walletService.transfer({
        privateKey: fromPrivateKey,
        to: toAddress,
        value: amountWei,
      });

      return txHash;
    } catch (error: any) {
      this.logger.error(`Payment execution failed: ${error.message}`, error);
      throw new Error(`Payment execution failed: ${error.message}`);
    }
  }

  /**
   * Wait for payment transaction confirmation
   */
  async waitForPaymentConfirmation(txHash: Hash): Promise<void> {
    await this.walletService.waitForTransaction(txHash);
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(
    txHash: Hash
  ): Promise<"pending" | "success" | "failed" | "not_found"> {
    try {
      const receipt = await this.walletService.getTransactionReceipt(txHash);

      if (receipt.status === "success") {
        return "success";
      } else if (receipt.status === "reverted") {
        return "failed";
      } else {
        return "pending";
      }
    } catch (error: any) {
      // Transaction not found
      return "not_found";
    }
  }
}
