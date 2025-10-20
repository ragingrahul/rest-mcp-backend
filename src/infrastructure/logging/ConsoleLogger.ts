/**
 * Console Logger Implementation
 * Simple console-based logger with colored output
 */

import { ILogger, LogLevel } from "../../core/interfaces/ILogger.js";

export class ConsoleLogger implements ILogger {
  private serviceName?: string;

  constructor(serviceName?: string) {
    this.serviceName = serviceName;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const service = this.serviceName ? `[${this.serviceName}]` : "";
    const levelStr = level.toUpperCase().padEnd(7);
    return `${timestamp} ${levelStr} ${service} ${message}`;
  }

  private formatContext(context?: Record<string, any>): string {
    if (!context || Object.keys(context).length === 0) {
      return "";
    }
    return ` ${JSON.stringify(context)}`;
  }

  debug(message: string, context?: Record<string, any>): void {
    const formatted = this.formatMessage(LogLevel.DEBUG, message);
    console.debug(formatted + this.formatContext(context));
  }

  info(message: string, context?: Record<string, any>): void {
    const formatted = this.formatMessage(LogLevel.INFO, message);
    console.log(formatted + this.formatContext(context));
  }

  warning(message: string, context?: Record<string, any>): void {
    const formatted = this.formatMessage(LogLevel.WARNING, message);
    console.warn(formatted + this.formatContext(context));
  }

  error(
    message: string,
    error?: Error | unknown,
    context?: Record<string, any>
  ): void {
    const formatted = this.formatMessage(LogLevel.ERROR, message);
    let errorDetails = "";

    if (error instanceof Error) {
      errorDetails = `\n  Error: ${error.message}\n  Stack: ${error.stack}`;
    } else if (error) {
      errorDetails = `\n  Error: ${JSON.stringify(error)}`;
    }

    console.error(formatted + this.formatContext(context) + errorDetails);
  }
}

// Export a default logger instance for backward compatibility
export const logger = new ConsoleLogger();
