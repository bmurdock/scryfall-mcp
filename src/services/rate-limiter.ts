import { RATE_LIMIT_CONFIG, RateLimitError } from '../types/mcp-types.js';
import { EnvValidators } from '../utils/env-parser.js';

interface QueuedRequest {
  resolve: (value: void) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

/**
 * Rate limiter that enforces minimum intervals between API calls
 * Implements queue-based system with exponential backoff for errors
 */
export class RateLimiter {
  private queue: QueuedRequest[] = [];
  private lastRequestTime = 0;
  private processing = false;
  private consecutiveErrors = 0;
  private readonly maxQueueSize: number;
  private activeTimeouts = new Set<NodeJS.Timeout>();

  constructor(
    private minInterval: number = EnvValidators.rateLimitMs(process.env.RATE_LIMIT_MS),
    private maxRetries: number = RATE_LIMIT_CONFIG.maxRetries,
    private backoffMultiplier: number = RATE_LIMIT_CONFIG.backoffMultiplier,
    private maxBackoffMs: number = RATE_LIMIT_CONFIG.maxBackoffMs
  ) {
    this.maxQueueSize = EnvValidators.rateLimitQueueMax(process.env.RATE_LIMIT_QUEUE_MAX);
  }

  /**
   * Waits for rate limit clearance before proceeding
   */
  async waitForClearance(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.maxQueueSize) {
        return reject(new RateLimitError('Queue capacity exceeded'));
      }
      this.queue.push({
        resolve,
        reject,
        timestamp: Date.now()
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Processes the request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    // Use atomic check-and-set to prevent race conditions
    if (this.processing) {
      return;
    }
    
    this.processing = true;

    try {
      while (this.queue.length > 0) {
        const request = this.queue.shift()!;
        
        try {
          await this.enforceRateLimit();
          request.resolve();
          this.consecutiveErrors = 0; // Reset error count on success
        } catch (error) {
          request.reject(error instanceof Error ? error : new Error('Unknown rate limit error'));
        }
      }
    } finally {
      // Ensure processing flag is always reset
      this.processing = false;
    }
  }

  /**
   * Enforces the minimum interval between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Calculate delay including exponential backoff for errors
    let delay = Math.max(0, this.minInterval - timeSinceLastRequest);
    
    if (this.consecutiveErrors > 0) {
      const backoffDelay = Math.min(
        this.minInterval * Math.pow(this.backoffMultiplier, this.consecutiveErrors),
        this.maxBackoffMs
      );
      delay = Math.max(delay, backoffDelay);
    }

    if (delay > 0) {
      await this.sleep(delay);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Records an error for backoff calculation
   */
  recordError(status?: number): void {
    this.consecutiveErrors++;
    
    // Special handling for 429 (Too Many Requests)
    if (status === 429) {
      this.consecutiveErrors = Math.max(this.consecutiveErrors, 2);
    }
  }

  /**
   * Records a successful request
   */
  recordSuccess(): void {
    this.consecutiveErrors = 0;
  }

  /**
   * Gets the current backoff delay
   */
  getCurrentBackoffDelay(): number {
    if (this.consecutiveErrors === 0) {
      return 0;
    }
    
    return Math.min(
      this.minInterval * Math.pow(this.backoffMultiplier, this.consecutiveErrors),
      this.maxBackoffMs
    );
  }

  /**
   * Checks if we should retry based on error count
   */
  shouldRetry(): boolean {
    return this.consecutiveErrors < this.maxRetries;
  }

  /**
   * Gets queue status for monitoring
   */
  getStatus(): {
    queueLength: number;
    processing: boolean;
    consecutiveErrors: number;
    currentBackoffDelay: number;
    lastRequestTime: number;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      consecutiveErrors: this.consecutiveErrors,
      currentBackoffDelay: this.getCurrentBackoffDelay(),
      lastRequestTime: this.lastRequestTime
    };
  }

  /**
   * Clears the queue and resets state
   */
  reset(): void {
    // Clear all active timeouts to prevent memory leaks
    for (const timeout of this.activeTimeouts) {
      clearTimeout(timeout);
    }
    this.activeTimeouts.clear();
    
    // Reject all pending requests
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      request.reject(new RateLimitError('Rate limiter was reset'));
    }
    
    this.processing = false;
    this.consecutiveErrors = 0;
    this.lastRequestTime = 0;
  }

  /**
   * Utility method for sleeping with timeout tracking
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        this.activeTimeouts.delete(timeout);
        resolve();
      }, ms);
      this.activeTimeouts.add(timeout);
    });
  }

  /**
   * Handles 429 responses with Retry-After header
   */
  async handleRateLimitResponse(retryAfter?: string): Promise<void> {
    this.recordError(429);

    let delay = this.getCurrentBackoffDelay();

    if (retryAfter) {
      const retryAfterMs = parseInt(retryAfter, 10) * 1000;
      if (!Number.isNaN(retryAfterMs)) {
        delay = Math.max(delay, retryAfterMs);
      }
    }

    if (delay > 0) {
      await this.sleep(delay);
    }
  }

  /**
   * Creates a circuit breaker pattern for API failures
   */
  isCircuitOpen(): boolean {
    return this.consecutiveErrors >= this.maxRetries;
  }

  /**
   * Gets estimated wait time for next request
   */
  getEstimatedWaitTime(): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const baseDelay = Math.max(0, this.minInterval - timeSinceLastRequest);
    const backoffDelay = this.getCurrentBackoffDelay();
    
    return Math.max(baseDelay, backoffDelay);
  }
}
