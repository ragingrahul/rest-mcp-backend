/**
 * Encryption utilities for private key storage
 * Uses AES-256-GCM for encryption
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Algorithm for encryption
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Get encryption key from environment or throw error
 */
function getEncryptionKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY environment variable is not set. Please set a 32-byte hex string."
    );
  }

  // Convert hex string to buffer
  if (key.length !== 64) {
    throw new Error(
      "WALLET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)"
    );
  }

  return Buffer.from(key, "hex");
}

/**
 * Encrypt a private key
 * Returns encrypted data in format: iv:authTag:encryptedData (all hex)
 */
export function encryptPrivateKey(privateKey: string): string {
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);

    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(privateKey, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Return format: iv:authTag:encryptedData
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  } catch (error: any) {
    throw new Error(`Failed to encrypt private key: ${error.message}`);
  }
}

/**
 * Decrypt an encrypted private key
 * Expects format: iv:authTag:encryptedData (all hex)
 */
export function decryptPrivateKey(encryptedData: string): string {
  try {
    const key = getEncryptionKey();

    // Split the encrypted data
    const parts = encryptedData.split(":");
    if (parts.length !== 3) {
      throw new Error("Invalid encrypted data format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encrypted = parts[2];

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error: any) {
    throw new Error(`Failed to decrypt private key: ${error.message}`);
  }
}

/**
 * Generate a random encryption key (for setup)
 * Returns a 32-byte hex string
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
