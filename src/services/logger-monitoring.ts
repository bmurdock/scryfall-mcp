import { mcpLogger } from './logger-core.js';

export class ErrorMonitor {
  private static errorCounts = new Map<string, number>();
  private static performanceMetrics = new Map<
    string,
    { count: number; totalTime: number; avgTime: number }
  >();
  private static correlationMap = new Map<string, string[]>();

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
        operation: 'error_tracking',
      },
      'Error tracked for monitoring'
    );
  }

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
        operation_type: 'performance_tracking',
      },
      'Performance metric tracked'
    );
  }

  static getErrorStats(): Record<string, number> {
    return Object.fromEntries(this.errorCounts);
  }

  static getPerformanceStats(): Record<
    string,
    { count: number; totalTime: number; avgTime: number }
  > {
    return Object.fromEntries(this.performanceMetrics);
  }

  static getRequestCorrelations(requestId: string): string[] {
    return this.correlationMap.get(requestId) || [];
  }

  static getAllCorrelations(): Record<string, string[]> {
    return Object.fromEntries(this.correlationMap);
  }

  static cleanupCorrelations(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs;
    const toDelete: string[] = [];

    for (const [requestId] of this.correlationMap) {
      const parts = requestId.split('_');
      if (parts.length >= 2) {
        const timestamp = parseInt(parts[1], 10);
        if (timestamp < cutoff) {
          toDelete.push(requestId);
        }
      }
    }

    toDelete.forEach(requestId => this.correlationMap.delete(requestId));

    mcpLogger.debug(
      {
        cleanedCount: toDelete.length,
        operation: 'correlation_cleanup',
      },
      'Cleaned up old correlation data'
    );
  }

  static reset(): void {
    this.errorCounts.clear();
    this.performanceMetrics.clear();
    this.correlationMap.clear();
    mcpLogger.info({ operation: 'monitoring_reset' }, 'Error monitoring data reset');
  }

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

export function measureTimeWithMonitoring<T>(
  operation: string,
  requestId: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  mcpLogger.debug({ requestId, operation, startTime }, 'Operation started');

  return fn().then(
    result => {
      const duration = Date.now() - startTime;
      ErrorMonitor.trackPerformance(operation, duration, requestId);
      mcpLogger.performance({ requestId, operation, duration }, 'Operation completed');
      return result;
    },
    error => {
      const duration = Date.now() - startTime;
      const errorCode = error instanceof Error ? error.constructor.name : 'UnknownError';
      ErrorMonitor.trackError(errorCode, requestId);
      ErrorMonitor.trackPerformance(`${operation}_failed`, duration, requestId);
      mcpLogger.error(
        {
          requestId,
          operation,
          duration,
          error,
        },
        'Operation failed'
      );
      throw error;
    }
  );
}
