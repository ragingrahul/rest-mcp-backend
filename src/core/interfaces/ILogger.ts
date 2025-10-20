/**
 * Logger Interface
 * Abstraction for logging to allow different implementations
 */

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

export interface ILogger {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warning(message: string, context?: Record<string, any>): void;
  error(
    message: string,
    error?: Error | unknown,
    context?: Record<string, any>
  ): void;
}
