/**
 * Rate Limiter Utility
 * Implements token bucket rate limiting
 * Uses in-memory storage (would use Redis in production)
 */

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Window in milliseconds
  keyPrefix?: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyPrefix: 'ratelimit_',
      ...config,
    };

    // Cleanup expired entries every minute
    setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a request is allowed
   * Returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const fullKey = `${this.config.keyPrefix}${key}`;

    const entry = this.store.get(fullKey);

    if (!entry || now >= entry.resetAt) {
      // Reset the counter
      this.store.set(fullKey, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });
      return true;
    }

    if (entry.count >= this.config.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get remaining requests
   */
  getRemainingRequests(key: string): number {
    const now = Date.now();
    const fullKey = `${this.config.keyPrefix}${key}`;

    const entry = this.store.get(fullKey);

    if (!entry || now >= entry.resetAt) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * Get reset time
   */
  getResetTime(key: string): number {
    const fullKey = `${this.config.keyPrefix}${key}`;
    const entry = this.store.get(fullKey);

    if (!entry) {
      return Date.now();
    }

    return entry.resetAt;
  }

  /**
   * Get retry after (seconds)
   */
  getRetryAfter(key: string): number {
    const resetTime = this.getResetTime(key);
    const retryAfterMs = Math.max(0, resetTime - Date.now());
    return Math.ceil(retryAfterMs / 1000);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset counter for a key
   */
  reset(key: string): void {
    const fullKey = `${this.config.keyPrefix}${key}`;
    this.store.delete(fullKey);
  }

  /**
   * Reset all counters
   */
  resetAll(): void {
    this.store.clear();
  }
}

// Create singleton instances for different rate limiters
export const nfcTokenCreationLimiter = new RateLimiter({
  maxRequests: 3,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'nfc_token_create_',
});

export const nfcPublicAccessLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'nfc_public_access_',
});

export const nfcOtpRequestLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'nfc_otp_request_',
});

export const nfcOtpVerificationLimiter = new RateLimiter({
  maxRequests: 3,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'nfc_otp_verify_',
});

export default RateLimiter;
