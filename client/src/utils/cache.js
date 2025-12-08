/**
 * Request caching layer
 * 
 * Provides intelligent caching for API requests to reduce redundant
 * network calls and improve application performance.
 */

import { logger } from './logger';

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(data, ttl = 5 * 60 * 1000) {
    this.data = data;
    this.timestamp = Date.now();
    this.ttl = ttl; // Time to live in milliseconds
    this.accessCount = 0;
  }

  isValid() {
    return Date.now() - this.timestamp < this.ttl;
  }

  touch() {
    this.accessCount++;
  }
}

/**
 * Request cache manager
 */
class RequestCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Generate cache key from request parameters
   */
  generateKey(url, params = {}) {
    const paramString = Object.keys(params)
      .sort()
      .map(key => `${key}=${JSON.stringify(params[key])}`)
      .join('&');
    return `${url}?${paramString}`;
  }

  /**
   * Get cached data
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    if (!entry.isValid()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    entry.touch();
    this.hits++;
    logger.debug('Cache hit', { key, accessCount: entry.accessCount });
    return entry.data;
  }

  /**
   * Set cached data
   */
  set(key, data, ttl) {
    // Enforce max cache size (LRU-style eviction)
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.findLeastRecentlyUsed();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        logger.debug('Cache eviction', { key: oldestKey });
      }
    }

    const entry = new CacheEntry(data, ttl);
    this.cache.set(key, entry);
    logger.debug('Cache set', { key, ttl });
  }

  /**
   * Find least recently used cache entry
   */
  findLeastRecentlyUsed() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * Invalidate cached data by key
   */
  invalidate(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      logger.debug('Cache invalidated', { key });
    }
    return deleted;
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern) {
    const regex = new RegExp(pattern);
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    if (count > 0) {
      logger.debug('Cache pattern invalidation', { pattern, count });
    }

    return count;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    logger.debug('Cache cleared', { entriesCleared: size });
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? (this.hits / total * 100).toFixed(2) : 0;

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
    };
  }
}

// Create global cache instance
const globalCache = new RequestCache();

/**
 * Cached request wrapper
 * @param {Function} requestFn - Async function that makes the request
 * @param {Object} options - Cache options
 * @returns {Promise} Cached or fresh data
 */
export const cachedRequest = async (requestFn, options = {}) => {
  const {
    key,
    ttl = 5 * 60 * 1000, // Default 5 minutes
    forceRefresh = false,
    cache = globalCache,
  } = options;

  if (!key) {
    logger.warn('Cached request called without cache key, fetching fresh data');
    return await requestFn();
  }

  // Check cache first
  if (!forceRefresh) {
    const cached = cache.get(key);
    if (cached !== null) {
      return cached;
    }
  }

  // Fetch fresh data
  try {
    const data = await requestFn();
    cache.set(key, data, ttl);
    return data;
  } catch (error) {
    // On error, try to return stale cache if available
    const staleEntry = cache.cache.get(key);
    if (staleEntry) {
      logger.warn('Request failed, returning stale cache', { key });
      return staleEntry.data;
    }
    throw error;
  }
};

/**
 * Create a cached version of an API function
 * @param {Function} apiFn - API function to cache
 * @param {Object} defaultOptions - Default cache options
 * @returns {Function} Cached API function
 */
export const createCachedAPI = (apiFn, defaultOptions = {}) => {
  return async (params, options = {}) => {
    const mergedOptions = { ...defaultOptions, ...options };
    const { ttl = 5 * 60 * 1000, keyPrefix = '' } = mergedOptions;

    const key = globalCache.generateKey(
      keyPrefix + apiFn.name,
      params
    );

    return cachedRequest(
      () => apiFn(params),
      { key, ttl, ...mergedOptions }
    );
  };
};

/**
 * Invalidate cache entries
 * @param {string|RegExp} keyOrPattern - Cache key or pattern to invalidate
 */
export const invalidateCache = (keyOrPattern) => {
  if (typeof keyOrPattern === 'string') {
    globalCache.invalidate(keyOrPattern);
  } else if (keyOrPattern instanceof RegExp) {
    globalCache.invalidatePattern(keyOrPattern.source);
  }
};

/**
 * Clear all cache
 */
export const clearCache = () => {
  globalCache.clear();
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return globalCache.getStats();
};

/**
 * React hook for cached requests
 * @param {Function} requestFn - Async request function
 * @param {Array} dependencies - Dependencies array (like useEffect)
 * @param {Object} options - Cache options
 * @returns {Object} { data, loading, error, refresh }
 */
export const useCachedRequest = (requestFn, dependencies, options = {}) => {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const result = await cachedRequest(requestFn, {
        ...options,
        forceRefresh,
      });
      setData(result);
    } catch (err) {
      setError(err);
      logger.error('Cached request failed', err);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  React.useEffect(() => {
    refresh(false);
  }, dependencies);

  return { data, loading, error, refresh };
};

/**
 * Expose cache to window for debugging
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__requestCache = {
    getStats: getCacheStats,
    clear: clearCache,
    invalidate: invalidateCache,
  };
}

export default {
  cachedRequest,
  createCachedAPI,
  invalidateCache,
  clearCache,
  getCacheStats,
  useCachedRequest,
};

