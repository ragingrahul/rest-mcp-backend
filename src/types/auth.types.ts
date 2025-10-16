/**
 * Authentication type definitions
 */

export type AuthType = "none" | "apiKey" | "bearer" | "basic";

export interface AuthConfig {
  type: AuthType;
  apiKey?: string;
  apiKeyLocation?: "header" | "query";
  apiKeyName?: string;
  token?: string;
  username?: string;
  password?: string;
}
