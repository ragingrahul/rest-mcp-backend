/**
 * Core API endpoint type definitions
 */

import { AuthConfig } from "./auth.types.js";

export enum HTTPMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
}

export type ParameterType =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array";
export type ParameterLocation = "path" | "query" | "body" | "header";

export interface APIParameter {
  name: string;
  type: ParameterType;
  description: string;
  location: ParameterLocation;
  required?: boolean;
  default?: any;
}

export interface APIEndpoint {
  id?: string; // UUID from Supabase
  user_id?: string; // Owner of the endpoint
  name: string;
  url: string;
  method: HTTPMethod;
  description: string;
  parameters: APIParameter[];
  headers?: Record<string, string>;
  timeout?: number;
  auth?: AuthConfig; // imported from auth.types.ts
  price_per_call_eth?: string; // Payment: ETH cost per call
  developer_wallet_address?: string; // Payment: where to send funds
  requires_payment?: boolean; // Payment: computed field
  created_at?: string; // ISO timestamp
  updated_at?: string; // ISO timestamp
}

/**
 * Database representation of endpoint (matches Supabase schema)
 */
export interface EndpointRecord {
  id: string;
  user_id: string;
  name: string;
  url: string;
  method: string;
  description: string;
  parameters: APIParameter[];
  headers?: Record<string, string>;
  timeout: number;
  created_at: string;
  updated_at: string;
}

/**
 * Input type for creating a new endpoint
 */
export interface CreateEndpointInput {
  name: string;
  url: string;
  method: HTTPMethod;
  description: string;
  parameters: APIParameter[];
  headers?: Record<string, string>;
  timeout?: number;
  auth?: AuthConfig;
  price_per_call_eth?: string; // Payment: ETH cost per call
  developer_wallet_address?: string; // Payment: developer's wallet
}

/**
 * Input type for updating an endpoint
 */
export interface UpdateEndpointInput {
  name?: string;
  url?: string;
  method?: HTTPMethod;
  description?: string;
  parameters?: APIParameter[];
  headers?: Record<string, string>;
  timeout?: number;
  auth?: AuthConfig;
  price_per_call_eth?: string; // Payment: ETH cost per call
  developer_wallet_address?: string; // Payment: developer's wallet
}
