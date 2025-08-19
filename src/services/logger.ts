/**
 * Structured logging service using Pino for MCP server
 * Provides high-performance JSON logging with correlation IDs and contextual information
 */

import pino from "pino";
import { MCPError } from "../types/mcp-errors.js";
import { EnvValidators } from "../utils/env-parser.js";

/**
 * Log levels supported by the logger
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * Base log context interface
 */
export interface LogContext {
  requestId?: string;
  toolName?: string;
  resourceUri?: string;
  promptName?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

/**
 * Performance tracking context
 */
export interface PerformanceContext extends LogContext {
  startTime?: number;
  duration?: number;
  operation?: string;
}

/**
 * Error logging context
 */
export interface ErrorContext extends LogContext {
  error?: Error | MCPError;
  errorCode?: string;
  statusCode?: number;
  stack?: string;
}

/**
 * Create Pino logger instance with MCP-specific configuration
 */
function createLogger() {
  const isDevelopment = EnvValidators.nodeEnv(process.env.NODE_ENV) === "development";
  const logLevel = EnvValidators.logLevel(process.env.LOG_LEVEL) as LogLevel;

  const baseConfig: pino.LoggerOptions = {
    level: logLevel,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: "scryfall-mcp",
        version: process.env.npm_package_version || "1.0.0",
      }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      error: (error: Error | MCPError) => {
        if (error instanceof MCPError) {
          return error.toLogFormat();
        }
        return pino.stdSerializers.err(error);
      },
    },
  };

  // Development configuration with pretty printing
  if (isDevelopment) {
    return pino({
      ...baseConfig,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l Z",
          ignore: "pid,hostname,service,version",
          messageFormat: "{requestId} [{toolName}] {msg}",
          customPrettifiers: {
            requestId: (requestId: string) => (requestId ? `[${requestId}]` : ""),
            toolName: (toolName: string) => (toolName ? `{${toolName}}` : ""),
          },
        },
      },
    });
  }

  // Production configuration with JSON output
  return pino(baseConfig);
}

/**
 * Logger instance
 */
export const logger = createLogger();

/**
 * Enhanced logger class with MCP-specific methods
 */
export class MCPLogger {
  private baseLogger: pino.Logger;

  constructor(baseLogger: pino.Logger = logger) {
    this.baseLogger = baseLogger;
  }

  /**
   * Create child logger with persistent context
   */
  child(context: LogContext): MCPLogger {
    return new MCPLogger(this.baseLogger.child(context));
  }

  /**
   * Log info message with context
   */
  info(context: LogContext, message: string): void {
    this.baseLogger.info(context, message);
  }

  /**
   * Log warning message with context
   */
  warn(context: LogContext, message: string): void {
    this.baseLogger.warn(context, message);
  }

  /**
   * Log error message with enhanced error context
   */
  error(context: ErrorContext, message: string): void {
    const errorContext = this.enhanceErrorContext(context);
    this.baseLogger.error(errorContext, message);
  }

  /**
   * Log debug message with context
   */
  debug(context: LogContext, message: string): void {
    this.baseLogger.debug(context, message);
  }

  /**
   * Log trace message with context
   */
  trace(context: LogContext, message: string): void {
    this.baseLogger.trace(context, message);
  }

  /**
   * Log fatal error and exit
   */
  fatal(context: ErrorContext, message: string): void {
    const errorContext = this.enhanceErrorContext(context);
    this.baseLogger.fatal(errorContext, message);
  }

  /**
   * Log tool execution start
   */
  toolStart(requestId: string, toolName: string, args?: Record<string, unknown>): void {
    this.info(
      {
        requestId,
        toolName,
        args: args ? this.sanitizeArgs(args) : undefined,
        phase: "start",
      },
      "Tool execution started"
    );
  }

  /**
   * Log tool execution completion
   */
  toolComplete(requestId: string, toolName: string, duration?: number): void {
    this.info(
      {
        requestId,
        toolName,
        duration,
        phase: "complete",
      },
      "Tool execution completed"
    );
  }

  /**
   * Log tool execution error
   */
  toolError(requestId: string, toolName: string, error: Error | MCPError, args?: Record<string, unknown>): void {
    this.error(
      {
        requestId,
        toolName,
        error,
        args: args ? this.sanitizeArgs(args) : undefined,
        phase: "error",
      },
      "Tool execution failed"
    );
  }

  /**
   * Log performance metrics
   */
  performance(context: PerformanceContext, message: string): void {
    const perfContext = {
      ...context,
      duration:
        context.duration || (context.startTime ? Date.now() - context.startTime : undefined),
    };
    this.info(perfContext, message);
  }

  /**
   * Log health check events
   */
  healthCheck(requestId: string, status: string, services?: Record<string, string>): void {
    this.info(
      {
        requestId,
        status,
        services,
        operation: "health_check",
      },
      `Health check ${status}`
    );
  }

  /**
   * Log request correlation
   */
  request(requestId: string, operation: string, context?: LogContext): void {
    this.info(
      {
        requestId,
        operation,
        ...context,
      },
      `Request ${operation}`
    );
  }

  /**
   * Enhance error context with additional error information
   */
  private enhanceErrorContext(context: ErrorContext): ErrorContext {
    if (!context.error) {
      return context;
    }

    const enhanced: ErrorContext = { ...context };

    if (context.error instanceof MCPError) {
      enhanced.errorCode = context.error.code;
      enhanced.statusCode = context.error.statusCode;
    }

    return enhanced;
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  private sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ["password", "token", "secret", "key", "auth", "authorization"];

    const redact = (value: unknown, depth = 0, seen = new WeakSet<object>()): unknown => {
      if (depth > 4) return "[REDACTED]"; // depth limit
      if (value === null || value === undefined) return value;
      if (typeof value !== 'object') return value;
      if (seen.has(value as object)) return "[REDACTED]";
      seen.add(value as object);

      if (Array.isArray(value)) {
        return value.slice(0, 50).map((v) => redact(v, depth + 1, seen)); // breadth limit
      }

      const obj = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
          out[k] = "[REDACTED]";
        } else {
          out[k] = redact(v, depth + 1, seen);
        }
      }
      return out;
    };

    return redact(args) as Record<string, unknown>;
  }
}

/**
 * Default MCP logger instance
 */
export const mcpLogger = new MCPLogger(logger);


/**
 * Error monitoring and metrics collection utilities
 */
export class ErrorMonitor {
  private static errorCounts = new Map<string, number>();
  private static performanceMetrics = new Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  >();
  private static correlationMap = new Map<string, string[]>();

  /**
   * Track error occurrence for monitoring
   */
  static trackError(errorCode: string, requestId?: string): void {
    const count = this.errorCounts.get(errorCode) || 0;
    this.errorCounts.set(errorCode, count + 1);

    if (requestId) {
      const correlations = this.correlationMap.get(requestId) || [];
      correlations.push(`error:${errorCode}`);
      this.correlationMap.set(requestId, correlations);
    }

    mcpLogger.debug(
      {
        errorCode,
        requestId,
        totalCount: count + 1,
        operation: "error_tracking",
      },
      "Error tracked for monitoring"
    );
  }

  /**
   * Track performance metrics
   */
  static trackPerformance(operation: string, duration: number, requestId?: string): void {
    const existing = this.performanceMetrics.get(operation) || {
      count: 0,
      totalTime: 0,
      avgTime: 0,
    };
    const newCount = existing.count + 1;
    const newTotalTime = existing.totalTime + duration;
    const newAvgTime = newTotalTime / newCount;

    this.performanceMetrics.set(operation, {
      count: newCount,
      totalTime: newTotalTime,
      avgTime: newAvgTime,
    });

    if (requestId) {
      const correlations = this.correlationMap.get(requestId) || [];
      correlations.push(`perf:${operation}:${duration}ms`);
      this.correlationMap.set(requestId, correlations);
    }

    mcpLogger.debug(
      {
        operation,
        duration,
        requestId,
        avgTime: newAvgTime,
        operation_type: "performance_tracking",
      },
      "Performance metric tracked"
    );
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  /**
   * Get performance statistics
   */
  static getPerformanceStats(): Record<
    string,
    { count: number; totalTime: number; avgTime: number }
  > {
    return Object.fromEntries(this.performanceMetrics);
  }

  /**
   * Get request correlation data
   */
  static getRequestCorrelations(requestId: string): string[] {
    return this.correlationMap.get(requestId) || [];
  }

  /**
   * Get all correlation data
   */
  static getAllCorrelations(): Record<string, string[]> {
    return Object.fromEntries(this.correlationMap);
  }

  /**
   * Clear old correlation data (cleanup)
   */
  static cleanupCorrelations(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    const toDelete: string[] = [];

    for (const [requestId] of this.correlationMap) {
      // Extract timestamp from request ID format: req_timestamp_random
      const parts = requestId.split("_");
      if (parts.length >= 2) {
        const timestamp = parseInt(parts[1]);
        if (timestamp < cutoff) {
          toDelete.push(requestId);
        }
      }
    }

    toDelete.forEach((requestId) => this.correlationMap.delete(requestId));

    mcpLogger.debug(
      {
        cleanedCount: toDelete.length,
        operation: "correlation_cleanup",
      },
      "Cleaned up old correlation data"
    );
  }

  /**
   * Reset all monitoring data
   */
  static reset(): void {
    this.errorCounts.clear();
    this.performanceMetrics.clear();
    this.correlationMap.clear();
    mcpLogger.info({ operation: "monitoring_reset" }, "Error monitoring data reset");
  }

  /**
   * Get comprehensive monitoring report
   */
  static getMonitoringReport(): {
    errors: Record<string, number>;
    performance: Record<string, { count: number; totalTime: number; avgTime: number }>;
    correlationCount: number;
    timestamp: string;
  } {
    return {
      errors: this.getErrorStats(),
      performance: this.getPerformanceStats(),
      correlationCount: this.correlationMap.size,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Enhanced measure time function with error monitoring
 */
export function measureTimeWithMonitoring<T>(
  operation: string,
  requestId: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  mcpLogger.debug({ requestId, operation, startTime }, "Operation started");

  return fn().then(
    (result) => {
      const duration = Date.now() - startTime;
      ErrorMonitor.trackPerformance(operation, duration, requestId);
      mcpLogger.performance({ requestId, operation, duration }, "Operation completed");
      return result;
    },
    (error) => {
      const duration = Date.now() - startTime;
      const errorCode = error instanceof Error ? error.constructor.name : "UnknownError";
      ErrorMonitor.trackError(errorCode, requestId);
      ErrorMonitor.trackPerformance(`${operation}_failed`, duration, requestId);
      mcpLogger.error(
        {
          requestId,
          operation,
          duration,
          error,
        },
        "Operation failed"
      );
      throw error;
    }
  );
}

/**
 * Export the base logger for direct use
 */
export { logger as baseLogger };
