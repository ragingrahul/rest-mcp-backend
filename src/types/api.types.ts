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
  name: string;
  url: string;
  method: HTTPMethod;
  description: string;
  parameters: APIParameter[];
  headers?: Record<string, string>;
  timeout?: number;
  auth?: AuthConfig; // imported from auth.types.ts
}
