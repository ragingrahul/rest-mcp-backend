/**
 * Logger Factory
 * Creates logger instances with service names
 */

import { ILogger } from "../../core/interfaces/ILogger.js";
import { ConsoleLogger } from "./ConsoleLogger.js";

export class LoggerFactory {
  private static loggers: Map<string, ILogger> = new Map();

  /**
   * Get or create a logger for a specific service/module
   */
  static getLogger(serviceName: string): ILogger {
    if (!this.loggers.has(serviceName)) {
      this.loggers.set(serviceName, new ConsoleLogger(serviceName));
    }
    return this.loggers.get(serviceName)!;
  }

  /**
   * Create a new logger instance (doesn't cache)
   */
  static createLogger(serviceName: string): ILogger {
    return new ConsoleLogger(serviceName);
  }

  /**
   * Clear all cached loggers (useful for testing)
   */
  static clearCache(): void {
    this.loggers.clear();
  }
}
