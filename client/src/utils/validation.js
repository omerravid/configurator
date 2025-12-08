/**
 * Input validation and sanitization utilities
 * 
 * Provides robust validation and sanitization for user inputs
 * to prevent XSS, injection attacks, and invalid data submission.
 */

/**
 * Sanitize string input by escaping HTML entities
 * @param {string} input - The string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeString = (input) => {
  if (typeof input !== 'string') return '';
  
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
};

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate username (alphanumeric, underscore, hyphen, 3-30 chars)
 * @param {string} username - Username to validate
 * @returns {boolean} True if username is valid
 */
export const isValidUsername = (username) => {
  if (typeof username !== 'string') return false;
  const usernameRegex = /^[a-zA-Z0-9_-]{3,30}$/;
  return usernameRegex.test(username);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, message: string}} Validation result
 */
export const validatePassword = (password) => {
  if (typeof password !== 'string') {
    return { valid: false, message: 'Password must be a string' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  if (password.length > 128) {
    return { valid: false, message: 'Password is too long (max 128 characters)' };
  }

  // Check for at least one letter and one number
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { 
      valid: false, 
      message: 'Password must contain at least one letter and one number' 
    };
  }

  return { valid: true, message: 'Password is valid' };
};

/**
 * Validate configuration name
 * @param {string} name - Configuration name to validate
 * @returns {{valid: boolean, message: string}} Validation result
 */
export const validateConfigName = (name) => {
  if (typeof name !== 'string') {
    return { valid: false, message: 'Name must be a string' };
  }

  if (name.trim().length === 0) {
    return { valid: false, message: 'Name cannot be empty' };
  }

  if (name.length > 100) {
    return { valid: false, message: 'Name is too long (max 100 characters)' };
  }

  // Prevent path traversal attempts
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return { 
      valid: false, 
      message: 'Name cannot contain path separators or relative paths' 
    };
  }

  return { valid: true, message: 'Name is valid' };
};

/**
 * Validate JSON string
 * @param {string} jsonString - JSON string to validate
 * @returns {{valid: boolean, message: string, parsed?: any}} Validation result
 */
export const validateJSON = (jsonString) => {
  if (typeof jsonString !== 'string') {
    return { valid: false, message: 'Input must be a string' };
  }

  if (jsonString.trim().length === 0) {
    return { valid: false, message: 'JSON cannot be empty' };
  }

  try {
    const parsed = JSON.parse(jsonString);
    return { valid: true, message: 'Valid JSON', parsed };
  } catch (error) {
    return { 
      valid: false, 
      message: `Invalid JSON: ${error.message}` 
    };
  }
};

/**
 * Validate MongoDB ObjectId format
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid ObjectId format
 */
export const isValidObjectId = (id) => {
  if (typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Sanitize file path (basic validation)
 * @param {string} path - File path to validate
 * @returns {{valid: boolean, message: string}} Validation result
 */
export const validateFilePath = (path) => {
  if (typeof path !== 'string') {
    return { valid: false, message: 'Path must be a string' };
  }

  // Prevent path traversal
  if (path.includes('..')) {
    return { valid: false, message: 'Path traversal not allowed' };
  }

  // Prevent absolute paths (should be relative)
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) {
    return { valid: false, message: 'Absolute paths not allowed' };
  }

  return { valid: true, message: 'Path is valid' };
};

/**
 * Sanitize URL for safe usage
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
export const sanitizeURL = (url) => {
  if (typeof url !== 'string') return null;

  try {
    const parsed = new URL(url);
    
    // Only allow http, https, and data protocols
    const allowedProtocols = ['http:', 'https:', 'data:'];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch (error) {
    return null;
  }
};

/**
 * Validate number within range
 * @param {any} value - Value to validate
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {{valid: boolean, message: string, value?: number}} Validation result
 */
export const validateNumber = (value, min = -Infinity, max = Infinity) => {
  const num = Number(value);

  if (isNaN(num)) {
    return { valid: false, message: 'Value must be a number' };
  }

  if (num < min) {
    return { valid: false, message: `Value must be at least ${min}` };
  }

  if (num > max) {
    return { valid: false, message: `Value must be at most ${max}` };
  }

  return { valid: true, message: 'Number is valid', value: num };
};

/**
 * Escape regex special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export const escapeRegex = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Sanitize object for safe display (deep clone with sanitization)
 * @param {any} obj - Object to sanitize
 * @param {number} maxDepth - Maximum recursion depth
 * @returns {any} Sanitized object
 */
export const sanitizeObject = (obj, maxDepth = 10) => {
  if (maxDepth <= 0) return '[Max Depth Reached]';

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth - 1));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value, maxDepth - 1);
    }
    return sanitized;
  }

  return String(obj);
};

export default {
  sanitizeString,
  isValidEmail,
  isValidUsername,
  validatePassword,
  validateConfigName,
  validateJSON,
  isValidObjectId,
  validateFilePath,
  sanitizeURL,
  validateNumber,
  escapeRegex,
  sanitizeObject,
};

