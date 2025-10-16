/**
 * Tool lifecycle type definitions
 */

export interface ToolRegistration {
  toolId: string;
  name: string;
  status: "registered" | "failed";
  error?: string;
  createdAt: Date;
}

export interface ToolExecutionContext {
  toolId: string;
  arguments: Record<string, any>;
  timestamp: Date;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: ToolError;
  metadata?: ExecutionMetadata;
}

export interface ToolError {
  message: string;
  code?: string;
  statusCode?: number;
}

export interface ExecutionMetadata {
  executionTime: number;
  timestamp: Date;
}
