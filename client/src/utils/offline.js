import { logger } from './logger';

/**
 * Offline Support Utilities
 * 
 * Provides offline functionality preparation:
 * - Connection status monitoring
 * - Request queue for offline operations
 * - Service Worker registration helpers
 * - Cache management
 * - Sync strategies
 */

/**
 * Online/Offline Status Manager
 */
class ConnectionManager {
  constructor() {
    this.listeners = new Set();
    this.isOnline = navigator.onLine;
    this.lastOnlineTime = Date.now();
    this.lastOfflineTime = null;

    this.init();
  }

  init() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    
    // Periodic connectivity check
    this.startHealthCheck();
  }

  handleOnline = () => {
    logger.info('Connection restored');
    this.isOnline = true;
    this.lastOnlineTime = Date.now();
    this.notify('online');
  };

  handleOffline = () => {
    logger.warn('Connection lost');
    this.isOnline = false;
    this.lastOfflineTime = Date.now();
    this.notify('offline');
  };

  startHealthCheck() {
    setInterval(async () => {
      const online = await this.checkConnection();
      if (online !== this.isOnline) {
        if (online) {
          this.handleOnline();
        } else {
          this.handleOffline();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  async checkConnection() {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(status) {
    this.listeners.forEach(callback => {
      try {
        callback(status, {
          isOnline: this.isOnline,
          lastOnlineTime: this.lastOnlineTime,
          lastOfflineTime: this.lastOfflineTime,
        });
      } catch (error) {
        logger.error('Connection listener error', error);
      }
    });
  }

  getStatus() {
    return {
      isOnline: this.isOnline,
      lastOnlineTime: this.lastOnlineTime,
      lastOfflineTime: this.lastOfflineTime,
      offlineDuration: this.lastOfflineTime 
        ? Date.now() - this.lastOfflineTime 
        : 0,
    };
  }

  destroy() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.listeners.clear();
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();

/**
 * Offline Request Queue
 */
class OfflineQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
    this.storageKey = 'offline_request_queue';
    this.loadFromStorage();

    // Process queue when online
    connectionManager.subscribe((status) => {
      if (status === 'online' && this.queue.length > 0) {
        this.processQueue();
      }
    });
  }

  /**
   * Add request to queue
   */
  enqueue(request) {
    const queueItem = {
      id: Date.now() + Math.random(),
      request,
      timestamp: Date.now(),
      attempts: 0,
      maxAttempts: 3,
    };

    this.queue.push(queueItem);
    this.saveToStorage();

    logger.info('Request queued for offline', { id: queueItem.id });
    return queueItem.id;
  }

  /**
   * Remove request from queue
   */
  dequeue(id) {
    this.queue = this.queue.filter(item => item.id !== id);
    this.saveToStorage();
  }

  /**
   * Process queued requests
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    logger.info('Processing offline queue', { count: this.queue.length });

    const itemsToProcess = [...this.queue];

    for (const item of itemsToProcess) {
      try {
        await this.executeRequest(item);
        this.dequeue(item.id);
        logger.info('Queued request processed', { id: item.id });
      } catch (error) {
        item.attempts++;
        logger.error('Queued request failed', { 
          id: item.id, 
          attempts: item.attempts,
          error 
        });

        if (item.attempts >= item.maxAttempts) {
          logger.error('Queued request max attempts reached', { id: item.id });
          this.dequeue(item.id);
        }
      }
    }

    this.saveToStorage();
    this.processing = false;

    // Process again if queue not empty
    if (this.queue.length > 0) {
      setTimeout(() => this.processQueue(), 1000);
    }
  }

  /**
   * Execute a queued request
   */
  async executeRequest(item) {
    const { url, method, headers, body } = item.request;

    const normalizedHeaders = (() => {
      // Ensure headers is a plain object and default JSON content type for bodies.
      const h = headers && typeof headers === 'object' ? { ...headers } : {};
      if (body != null && !h['Content-Type'] && !h['content-type']) {
        h['Content-Type'] = 'application/json';
      }
      return h;
    })();

    const requestBody =
      body == null
        ? undefined
        : typeof body === 'string'
          ? body
          : JSON.stringify(body);

    const response = await fetch(url, {
      method,
      headers: normalizedHeaders,
      body: requestBody,
      // Allow future cookie-based auth (and avoids surprises if backend switches to cookies).
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return response;
  }

  /**
   * Load queue from storage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.queue = JSON.parse(stored);
        logger.debug('Offline queue loaded from storage', { 
          count: this.queue.length 
        });
      }
    } catch (error) {
      logger.error('Failed to load offline queue', error);
    }
  }

  /**
   * Save queue to storage
   */
  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      logger.error('Failed to save offline queue', error);
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      count: this.queue.length,
      processing: this.processing,
      items: this.queue.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        attempts: item.attempts,
        url: item.request.url,
        method: item.request.method,
      })),
    };
  }

  /**
   * Clear queue
   */
  clear() {
    this.queue = [];
    this.saveToStorage();
    logger.info('Offline queue cleared');
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue();

/**
 * Service Worker Registration
 */
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    logger.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    logger.info('Service Worker registered', { scope: registration.scope });

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      logger.info('Service Worker update found');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          logger.info('New Service Worker available');
          // Notify user about update
          window.dispatchEvent(new CustomEvent('sw-update-available'));
        }
      });
    });

    return registration;
  } catch (error) {
    logger.error('Service Worker registration failed', error);
    return null;
  }
};

/**
 * Unregister Service Worker
 */
export const unregisterServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const unregistered = await registration.unregister();
    
    if (unregistered) {
      logger.info('Service Worker unregistered');
    }
    
    return unregistered;
  } catch (error) {
    logger.error('Service Worker unregister failed', error);
    return false;
  }
};

/**
 * Cache Management
 */
export const cacheManager = {
  /**
   * Get cache size
   */
  async getCacheSize() {
    if (!('caches' in window)) {
      return 0;
    }

    let total = 0;
    const cacheNames = await caches.keys();

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const requests = await cache.keys();
      
      for (const request of requests) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          total += blob.size;
        }
      }
    }

    return total;
  },

  /**
   * Clear all caches
   */
  async clearAll() {
    if (!('caches' in window)) {
      return false;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      logger.info('All caches cleared');
      return true;
    } catch (error) {
      logger.error('Failed to clear caches', error);
      return false;
    }
  },

  /**
   * Clear specific cache
   */
  async clear(cacheName) {
    if (!('caches' in window)) {
      return false;
    }

    try {
      const deleted = await caches.delete(cacheName);
      if (deleted) {
        logger.info('Cache cleared', { cacheName });
      }
      return deleted;
    } catch (error) {
      logger.error('Failed to clear cache', error);
      return false;
    }
  },

  /**
   * List all caches
   */
  async list() {
    if (!('caches' in window)) {
      return [];
    }

    try {
      const cacheNames = await caches.keys();
      const cacheInfo = [];

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        cacheInfo.push({
          name,
          itemCount: requests.length,
        });
      }

      return cacheInfo;
    } catch (error) {
      logger.error('Failed to list caches', error);
      return [];
    }
  },
};

/**
 * React hook for connection status
 */
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = React.useState(connectionManager.isOnline);

  React.useEffect(() => {
    const unsubscribe = connectionManager.subscribe((status) => {
      setIsOnline(status === 'online');
    });

    return unsubscribe;
  }, []);

  return isOnline;
};

/**
 * React hook for offline queue status
 */
export const useOfflineQueue = () => {
  const [queueStatus, setQueueStatus] = React.useState(offlineQueue.getStatus());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setQueueStatus(offlineQueue.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return queueStatus;
};

/**
 * Offline-first fetch wrapper
 */
export const offlineFetch = async (url, options = {}) => {
  const { offlineFirst = false, ...fetchOptions } = options;

  // Try cache first if offline-first
  if (offlineFirst && 'caches' in window) {
    try {
      const cache = await caches.open('api-cache');
      const cachedResponse = await cache.match(url);
      
      if (cachedResponse) {
        logger.debug('Serving from cache', { url });
        return cachedResponse;
      }
    } catch (error) {
      logger.error('Cache lookup failed', error);
    }
  }

  // Try network
  try {
    const response = await fetch(url, fetchOptions);
    
    // Cache successful GET requests
    if (response.ok && fetchOptions.method === 'GET' && 'caches' in window) {
      try {
        const cache = await caches.open('api-cache');
        await cache.put(url, response.clone());
      } catch (error) {
        logger.error('Failed to cache response', error);
      }
    }
    
    return response;
  } catch (error) {
    // Network failed
    if (!connectionManager.isOnline) {
      // Queue for later if it's a mutation
      if (fetchOptions.method && fetchOptions.method !== 'GET') {
        offlineQueue.enqueue({
          url,
          method: fetchOptions.method,
          headers: fetchOptions.headers,
          body: fetchOptions.body,
        });
        
        throw new Error('Request queued for when online');
      }

      // Try cache as fallback
      if ('caches' in window) {
        const cache = await caches.open('api-cache');
        const cachedResponse = await cache.match(url);
        
        if (cachedResponse) {
          logger.info('Serving stale cache (offline)', { url });
          return cachedResponse;
        }
      }
    }

    throw error;
  }
};

/**
 * Check if offline mode is available
 */
export const isOfflineModeAvailable = () => {
  return 'serviceWorker' in navigator && 'caches' in window;
};

/**
 * Get offline capabilities status
 */
export const getOfflineStatus = async () => {
  const status = {
    supported: isOfflineModeAvailable(),
    serviceWorkerRegistered: false,
    cacheSize: 0,
    queuedRequests: offlineQueue.getStatus().count,
    isOnline: connectionManager.isOnline,
  };

  if (status.supported) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      status.serviceWorkerRegistered = !!registration;
      status.cacheSize = await cacheManager.getCacheSize();
    } catch (error) {
      logger.error('Failed to get offline status', error);
    }
  }

  return status;
};

// Import React for hooks
import React from 'react';

export default {
  connectionManager,
  offlineQueue,
  registerServiceWorker,
  unregisterServiceWorker,
  cacheManager,
  useOnlineStatus,
  useOfflineQueue,
  offlineFetch,
  isOfflineModeAvailable,
  getOfflineStatus,
};


