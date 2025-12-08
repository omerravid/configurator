/**
 * CSRF (Cross-Site Request Forgery) Protection Utilities
 * 
 * Provides client-side utilities for CSRF token management.
 * Note: Full CSRF protection requires backend support to generate and validate tokens.
 */

import { logger } from './logger';

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';

/**
 * Get CSRF token from cookie
 * The backend should set a CSRF token in a cookie (not httpOnly)
 * @returns {string|null} The CSRF token or null
 */
export const getCsrfToken = () => {
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === CSRF_TOKEN_KEY) {
        return decodeURIComponent(value);
      }
    }
  } catch (error) {
    logger.error('Failed to get CSRF token from cookie', error);
  }
  return null;
};

/**
 * Get CSRF token from meta tag
 * Alternative method: token can be embedded in HTML meta tag
 * @returns {string|null} The CSRF token or null
 */
export const getCsrfTokenFromMeta = () => {
  try {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    return metaTag ? metaTag.getAttribute('content') : null;
  } catch (error) {
    logger.error('Failed to get CSRF token from meta tag', error);
  }
  return null;
};

/**
 * Get CSRF token (tries cookie first, then meta tag)
 * @returns {string|null} The CSRF token or null
 */
export const getToken = () => {
  return getCsrfToken() || getCsrfTokenFromMeta();
};

/**
 * Add CSRF token to request headers
 * @param {Object} headers - Existing headers object
 * @returns {Object} Headers with CSRF token added
 */
export const addCsrfHeader = (headers = {}) => {
  const token = getToken();
  if (token) {
    return {
      ...headers,
      [CSRF_HEADER_NAME]: token,
    };
  }
  return headers;
};

/**
 * Add CSRF token to form data
 * @param {FormData} formData - FormData object
 * @returns {FormData} FormData with CSRF token added
 */
export const addCsrfToFormData = (formData) => {
  const token = getToken();
  if (token) {
    formData.append('_csrf', token);
  }
  return formData;
};

/**
 * Validate that CSRF token exists
 * @returns {boolean} True if CSRF token is available
 */
export const hasCsrfToken = () => {
  return getToken() !== null;
};

/**
 * Get CSRF header name
 * @returns {string} The CSRF header name
 */
export const getCsrfHeaderName = () => {
  return CSRF_HEADER_NAME;
};

/**
 * Create a double-submit cookie CSRF token
 * This is a client-side generated token that should match server validation
 * Note: This is less secure than server-generated tokens
 * @returns {string} Generated CSRF token
 */
export const generateClientToken = () => {
  // Generate a random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  
  // Store in sessionStorage as backup
  try {
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  } catch (error) {
    logger.warn('Failed to store CSRF token in sessionStorage', { error: error.message });
  }
  
  return token;
};

/**
 * Get or create CSRF token (for double-submit cookie pattern)
 * @returns {string} The CSRF token
 */
export const getOrCreateToken = () => {
  let token = getToken();
  
  if (!token) {
    // Try sessionStorage
    try {
      token = sessionStorage.getItem(CSRF_TOKEN_KEY);
    } catch (error) {
      logger.debug('Failed to get CSRF token from sessionStorage');
    }
  }
  
  if (!token) {
    // Generate new token
    token = generateClientToken();
    logger.debug('Generated new client-side CSRF token');
  }
  
  return token;
};

/**
 * Verify origin header matches expected origin
 * @param {string} origin - Origin header value
 * @param {string[]} allowedOrigins - List of allowed origins
 * @returns {boolean} True if origin is allowed
 */
export const verifyOrigin = (origin, allowedOrigins = []) => {
  if (!origin) return false;
  
  // Add current origin as allowed by default
  const currentOrigin = window.location.origin;
  if (!allowedOrigins.includes(currentOrigin)) {
    allowedOrigins.push(currentOrigin);
  }
  
  return allowedOrigins.includes(origin);
};

/**
 * Check if request is same-origin
 * @param {string} url - URL to check
 * @returns {boolean} True if URL is same-origin
 */
export const isSameOrigin = (url) => {
  try {
    const requestUrl = new URL(url, window.location.origin);
    return requestUrl.origin === window.location.origin;
  } catch (error) {
    logger.warn('Failed to parse URL for origin check', { url });
    return false;
  }
};

/**
 * CSRF protection middleware for fetch requests
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @returns {Object} Modified fetch options with CSRF protection
 */
export const csrfProtectedFetch = (url, options = {}) => {
  // Only add CSRF token for same-origin, state-changing requests
  const isSafe = ['GET', 'HEAD', 'OPTIONS'].includes(
    (options.method || 'GET').toUpperCase()
  );
  
  if (!isSafe && isSameOrigin(url)) {
    const token = getToken();
    if (token) {
      options.headers = addCsrfHeader(options.headers);
    } else {
      logger.warn('CSRF token not available for protected request', { url });
    }
  }
  
  return options;
};

export default {
  getCsrfToken,
  getCsrfTokenFromMeta,
  getToken,
  addCsrfHeader,
  addCsrfToFormData,
  hasCsrfToken,
  getCsrfHeaderName,
  generateClientToken,
  getOrCreateToken,
  verifyOrigin,
  isSameOrigin,
  csrfProtectedFetch,
};

