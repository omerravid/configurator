/**
 * Rate limiting utility for the frontend
 * 
 * Provides client-side rate limiting to prevent excessive API calls
 * and provide user feedback when rate limits are approached or exceeded.
 */

import { logger } from './logger';

/**
 * Rate limiter class
 */
class RateLimiter {
  constructor(maxRequests, windowMs) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = [];
  }

  /**
   * Check if a request is allowed
   * @returns {{allowed: boolean, remaining: number, resetTime: number}}
   */
  checkLimit() {
    const now = Date.now();
    
    // Remove requests outside the current window
    this.requests = this.requests.filter(time => now - time < this.windowMs);

    const remaining = this.maxRequests - this.requests.length;
    const resetTime = this.requests.length > 0 
      ? this.requests[0] + this.windowMs 
      : now + this.windowMs;

    if (this.requests.length >= this.maxRequests) {
      logger.warn('Rate limit exceeded', { 
        limit: this.maxRequests, 
        window: this.windowMs,
        resetIn: Math.ceil((resetTime - now) / 1000) 
      });
      return { 
        allowed: false, 
        remaining: 0, 
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000)
      };
    }

    this.requests.push(now);
    return { 
      allowed: true, 
      remaining: remaining - 1, 
      resetTime 
    };
  }

  /**
   * Reset the rate limiter
   */
  reset() {
    this.requests = [];
  }
}

// Create rate limiters for different types of operations
const rateLimiters = {
  // Login attempts: 5 per minute
  login: new RateLimiter(5, 60 * 1000),
  
  // API requests: 100 per minute
  api: new RateLimiter(100, 60 * 1000),
  
  // Configuration updates: 30 per minute
  configUpdate: new RateLimiter(30, 60 * 1000),
  
  // File uploads: 10 per minute
  fileUpload: new RateLimiter(10, 60 * 1000),
  
  // Search/query operations: 50 per minute
  search: new RateLimiter(50, 60 * 1000),
};

/**
 * Check rate limit for an operation type
 * @param {string} type - Type of operation (login, api, configUpdate, fileUpload, search)
 * @returns {{allowed: boolean, remaining: number, resetTime: number, retryAfter?: number}}
 */
export const checkRateLimit = (type) => {
  const limiter = rateLimiters[type] || rateLimiters.api;
  return limiter.checkLimit();
};

/**
 * Reset rate limiter for a specific type
 * @param {string} type - Type of operation to reset
 */
export const resetRateLimit = (type) => {
  if (rateLimiters[type]) {
    rateLimiters[type].reset();
  }
};

/**
 * Get human-readable message for rate limit status
 * @param {{allowed: boolean, remaining: number, resetTime: number, retryAfter?: number}} status
 * @returns {string} Human-readable message
 */
export const getRateLimitMessage = (status) => {
  if (status.allowed) {
    if (status.remaining <= 5) {
      return `Warning: Only ${status.remaining} requests remaining in this time window.`;
    }
    return '';
  } else {
    const seconds = status.retryAfter || 0;
    if (seconds > 60) {
      const minutes = Math.ceil(seconds / 60);
      return `Rate limit exceeded. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
    }
    return `Rate limit exceeded. Please try again in ${seconds} second${seconds > 1 ? 's' : ''}.`;
  }
};

/**
 * Debounce function - delays execution until after wait time has elapsed
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function - limits execution to once per specified time
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Create a rate-limited version of an async function
 * @param {Function} func - Async function to rate limit
 * @param {string} type - Rate limit type
 * @returns {Function} Rate-limited function
 */
export const rateLimitedFunction = (func, type = 'api') => {
  return async function(...args) {
    const status = checkRateLimit(type);
    
    if (!status.allowed) {
      const message = getRateLimitMessage(status);
      throw new Error(message);
    }
    
    return await func(...args);
  };
};

export default {
  checkRateLimit,
  resetRateLimit,
  getRateLimitMessage,
  debounce,
  throttle,
  rateLimitedFunction,
};


