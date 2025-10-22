/**
 * Payment system type definitions
 */

export enum PaymentStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  COMPLETED = "completed",
  FAILED = "failed",
  EXPIRED = "expired",
}

/**
 * Endpoint pricing configuration
 */
export interface EndpointPricing {
  id?: string;
  endpoint_id: string;
  price_per_call_eth: string; // Stored as string to preserve precision
  developer_wallet_address: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * User's balance in platform wallet (internal accounting)
 */
export interface UserBalance {
  id?: string;
  user_id: string;
  balance_eth: string; // Current balance
  total_deposited_eth: string; // Total deposited
  total_spent_eth: string; // Total spent on tools
  created_at?: string;
  updated_at?: string;
}

/**
 * Payment transaction record
 */
export interface PaymentTransaction {
  id?: string;
  payment_id: string; // Unique identifier for this payment (pay_xxx)
  user_id: string;
  endpoint_id: string;
  from_wallet: string; // Platform wallet address
  to_wallet: string; // Developer wallet address
  amount_eth: string;
  status: PaymentStatus;
  blockchain_tx_hash?: string; // On-chain transaction hash (optional)
  error_message?: string;
  created_at?: string;
  submitted_at?: string;
  completed_at?: string;
}

/**
 * Response for 402 Payment Required
 */
export interface PaymentRequiredResponse {
  success: false;
  status_code: 402;
  message: string;
  payment_details: {
    payment_id: string;
    amount_eth: string;
    developer_wallet: string;
    your_balance: string;
    next_step: string;
  };
}

/**
 * Payment approval response
 */
export interface PaymentApprovalResponse {
  success: boolean;
  tx_hash?: string;
  amount?: string;
  status?: string;
  message: string;
  remaining_balance?: string;
}

/**
 * Balance response
 */
export interface BalanceResponse {
  success: boolean;
  balance_eth: string;
  total_deposited_eth: string;
  total_spent_eth: string;
  platform_wallet_address: string; // For deposits
}

/**
 * Deposit input
 */
export interface DepositInput {
  user_id: string;
  amount_eth: string;
  tx_hash?: string; // Optional: blockchain transaction hash for verification
}

/**
 * Create pricing input
 */
export interface CreatePricingInput {
  endpoint_id: string;
  price_per_call_eth: string;
  developer_wallet_address: string;
}

/**
 * Update pricing input
 */
export interface UpdatePricingInput {
  price_per_call_eth?: string;
  developer_wallet_address?: string;
}
