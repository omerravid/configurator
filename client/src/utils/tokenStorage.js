/**
 * Secure token storage utility
 * 
 * Prioritizes httpOnly cookies for token storage, with localStorage fallback
 * for backwards compatibility and development scenarios.
 * 
 * Security Note: httpOnly cookies are strongly preferred as they:
 * - Cannot be accessed via JavaScript (XSS protection)
 * - Are automatically sent with requests
 * - Can be configured with Secure and SameSite flags
 */

import { logger } from './logger';

const TOKEN_KEY = 'token';
const COOKIE_NAME = 'auth_token';

/**
 * Check if cookies are available and accessible
 */
const areCookiesAvailable = () => {
  try {
    // httpOnly cookies cannot be read by JS, but we can check for any cookies
    return navigator.cookieEnabled;
  } catch (error) {
    logger.warn('Cookie check failed', { error: error.message });
    return false;
  }
};

/**
 * Get token from httpOnly cookie (if set by server)
 * Note: httpOnly cookies cannot be read by JavaScript
 * This function exists for completeness but will always return null for httpOnly cookies
 */
const getTokenFromCookie = () => {
  try {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === COOKIE_NAME) {
        return value;
      }
    }
  } catch (error) {
    logger.debug('Failed to read cookie', { error: error.message });
  }
  return null;
};

/**
 * Get token from localStorage (fallback)
 */
const getTokenFromStorage = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    logger.warn('Failed to read from localStorage', { error: error.message });
    return null;
  }
};

/**
 * Get authentication token
 * Priority: httpOnly cookie > localStorage
 * 
 * @returns {string|null} The authentication token or null
 */
export const getToken = () => {
  // Try cookie first (for non-httpOnly cookies)
  const cookieToken = getTokenFromCookie();
  if (cookieToken) {
    logger.debug('Token retrieved from cookie');
    return cookieToken;
  }

  // Fallback to localStorage
  const storageToken = getTokenFromStorage();
  if (storageToken) {
    logger.debug('Token retrieved from localStorage');
    return storageToken;
  }

  return null;
};

/**
 * Store token
 * 
 * Note: This only stores in localStorage. For httpOnly cookies,
 * the server must set the cookie via Set-Cookie header.
 * 
 * @param {string} token - The token to store
 */
export const setToken = (token) => {
  if (!token) {
    logger.warn('Attempted to set null/undefined token');
    return;
  }

  try {
    // Store in localStorage (for backwards compatibility)
    localStorage.setItem(TOKEN_KEY, token);
    logger.debug('Token stored in localStorage');

    // Note: For httpOnly cookies, the server should set this via Set-Cookie header
    // Client-side code cannot set httpOnly cookies
  } catch (error) {
    logger.error('Failed to store token', error);
  }
};

/**
 * Remove token from all storage locations
 */
export const removeToken = () => {
  try {
    // Remove from localStorage
    localStorage.removeItem(TOKEN_KEY);
    logger.debug('Token removed from localStorage');

    // For httpOnly cookies, we need to call a logout endpoint on the server
    // The server should clear the cookie with Set-Cookie: auth_token=; Max-Age=0
    
    // We can try to clear non-httpOnly cookie (this won't work for httpOnly)
    if (areCookiesAvailable()) {
      document.cookie = `${COOKIE_NAME}=; Max-Age=0; path=/; SameSite=Strict`;
    }
  } catch (error) {
    logger.error('Failed to remove token', error);
  }
};

/**
 * Check if user is authenticated
 * @returns {boolean} True if a token exists
 */
export const isAuthenticated = () => {
  return getToken() !== null;
};

/**
 * Get the Authorization header value
 * @returns {string|null} The Bearer token header or null
 */
export const getAuthHeader = () => {
  const token = getToken();
  return token ? `Bearer ${token}` : null;
};

export default {
  getToken,
  setToken,
  removeToken,
  isAuthenticated,
  getAuthHeader,
};


