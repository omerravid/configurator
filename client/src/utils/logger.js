/**
 * Secure logging utility that respects environment modes and sanitizes sensitive data.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.debug('Debug message', { data });
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message', error);
 */

const isDevelopment = import.meta.env.DEV;

/**
 * Sensitive field names that should be redacted from logs
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'apikey',
  'api_key',
  'secret',
  'authorization',
  'auth',
  'credential',
  'passwd',
  'pwd',
];

/**
 * Check if a key contains sensitive information
 * @param {string} key - The key to check
 * @returns {boolean} True if the key is sensitive
 */
const isSensitiveKey = (key) => {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive));
};

/**
 * Sanitize an object by redacting sensitive fields
 * @param {any} data - The data to sanitize
 * @returns {any} Sanitized data
 */
const sanitize = (data) => {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

/**
 * Logger utility with environment-aware logging and sensitive data sanitization
 */
export const logger = {
  /**
   * Log debug messages (only in development)
   * @param {string} message - The message to log
   * @param {any} context - Optional context data
   */
  debug: (message, context) => {
    if (!isDevelopment) return;
    if (context) {
      console.debug(message, sanitize(context));
    } else {
      console.debug(message);
    }
  },

  /**
   * Log info messages (only in development)
   * @param {string} message - The message to log
   * @param {any} context - Optional context data
   */
  info: (message, context) => {
    if (!isDevelopment) return;
    if (context) {
      console.info(message, sanitize(context));
    } else {
      console.info(message);
    }
  },

  /**
   * Log warning messages (only in development)
   * @param {string} message - The message to log
   * @param {any} context - Optional context data
   */
  warn: (message, context) => {
    if (!isDevelopment) return;
    if (context) {
      console.warn(message, sanitize(context));
    } else {
      console.warn(message);
    }
  },

  /**
   * Log error messages (always logged, even in production)
   * @param {string} message - The message to log
   * @param {Error} error - Optional error object
   * @param {any} context - Optional context data
   */
  error: (message, error, context) => {
    if (error && context) {
      console.error(message, error, sanitize(context));
    } else if (error) {
      console.error(message, error);
    } else if (context) {
      console.error(message, sanitize(context));
    } else {
      console.error(message);
    }
  },
};

export default logger;

