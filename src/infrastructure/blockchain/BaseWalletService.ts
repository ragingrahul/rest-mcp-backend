/**
 * Base Blockchain Wallet Service
 * Handles wallet creation, balance checking, and transaction signing using viem
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  type Address,
  type Hash,
  type PrivateKeyAccount,
} from "viem";
import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "crypto";
import { ILogger } from "../../core/interfaces/ILogger.js";
import { LoggerFactory } from "../logging/LoggerFactory.js";

export interface WalletCreateResult {
  address: string;
  privateKey: string;
}

export interface TransferParams {
  privateKey: string;
  to: Address;
  value: bigint;
}

export class BaseWalletService {
  private logger: ILogger;
  private publicClient;
  private chain;
  private rpcUrl: string;

  constructor(logger?: ILogger) {
    this.logger = logger || LoggerFactory.getLogger("BaseWalletService");

    // Determine chain based on environment
    const isMainnet = process.env.BASE_NETWORK === "mainnet";
    this.chain = isMainnet ? base : baseSepolia;

    // Get RPC URL from environment or use default
    this.rpcUrl =
      process.env.BASE_RPC_URL ||
      (isMainnet ? "https://mainnet.base.org" : "https://sepolia.base.org");

    // Create public client for reading blockchain state
    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(this.rpcUrl),
    });

    this.logger.info(
      `Initialized BaseWalletService on ${this.chain.name} (Chain ID: ${this.chain.id})`
    );
  }

  /**
   * Create a new Base wallet
   * Returns the address and private key (to be encrypted before storage)
   */
  createWallet(): WalletCreateResult {
    try {
      // Generate random 32 bytes for private key
      const privateKeyBytes = randomBytes(32);
      const privateKey =
        `0x${privateKeyBytes.toString("hex")}` as `0x${string}`;

      // Create account from private key
      const account = privateKeyToAccount(privateKey);

      this.logger.info(`Created new wallet: ${account.address}`);

      return {
        address: account.address,
        privateKey: privateKey,
      };
    } catch (error: any) {
      this.logger.error(`Failed to create wallet: ${error.message}`, error);
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  /**
   * Get the ETH balance of a wallet address
   * Returns balance as a string in ETH (not wei)
   */
  async getBalance(address: Address): Promise<string> {
    try {
      const balanceWei = await this.publicClient.getBalance({
        address,
      });

      const balanceEth = formatEther(balanceWei);
      this.logger.info(`Balance for ${address}: ${balanceEth} ETH`);

      return balanceEth;
    } catch (error: any) {
      this.logger.error(
        `Failed to get balance for ${address}: ${error.message}`,
        error
      );
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Get balance in wei as a bigint
   */
  async getBalanceWei(address: Address): Promise<bigint> {
    try {
      const balanceWei = await this.publicClient.getBalance({
        address,
      });

      return balanceWei;
    } catch (error: any) {
      this.logger.error(
        `Failed to get balance for ${address}: ${error.message}`,
        error
      );
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Create account from private key
   */
  private createAccount(privateKey: string): PrivateKeyAccount {
    if (!privateKey.startsWith("0x")) {
      privateKey = `0x${privateKey}`;
    }
    return privateKeyToAccount(privateKey as `0x${string}`);
  }

  /**
   * Transfer ETH from one address to another
   * Signs and broadcasts the transaction
   */
  async transfer(params: TransferParams): Promise<Hash> {
    try {
      const account = this.createAccount(params.privateKey);

      // Create wallet client for sending transactions
      const walletClient = createWalletClient({
        account,
        chain: this.chain,
        transport: http(this.rpcUrl),
      });

      this.logger.info(
        `Transferring ${formatEther(params.value)} ETH from ${account.address} to ${params.to}`
      );

      // Send transaction
      const hash = await walletClient.sendTransaction({
        to: params.to,
        value: params.value,
      });

      this.logger.info(`Transaction submitted: ${hash}`);

      return hash;
    } catch (error: any) {
      this.logger.error(`Transfer failed: ${error.message}`, error);
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransaction(hash: Hash): Promise<void> {
    try {
      this.logger.info(`Waiting for transaction confirmation: ${hash}`);

      await this.publicClient.waitForTransactionReceipt({
        hash,
      });

      this.logger.info(`Transaction confirmed: ${hash}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to wait for transaction: ${error.message}`,
        error
      );
      throw new Error(`Transaction wait failed: ${error.message}`);
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(hash: Hash) {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash,
      });

      return receipt;
    } catch (error: any) {
      this.logger.error(
        `Failed to get transaction receipt: ${error.message}`,
        error
      );
      throw new Error(`Failed to get receipt: ${error.message}`);
    }
  }

  /**
   * Check if a transaction is confirmed
   */
  async isTransactionConfirmed(hash: Hash): Promise<boolean> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({
        hash,
      });

      return receipt.status === "success";
    } catch (error: any) {
      // Transaction not found or not confirmed yet
      return false;
    }
  }

  /**
   * Parse ETH amount string to wei (bigint)
   */
  parseEthToWei(ethAmount: string): bigint {
    return parseEther(ethAmount);
  }

  /**
   * Format wei (bigint) to ETH string
   */
  formatWeiToEth(weiAmount: bigint): string {
    return formatEther(weiAmount);
  }

  /**
   * Get chain ID
   */
  getChainId(): number {
    return this.chain.id;
  }

  /**
   * Get chain name
   */
  getChainName(): string {
    return this.chain.name;
  }
}
