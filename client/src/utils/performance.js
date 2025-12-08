/**
 * Performance monitoring utilities
 * 
 * Provides tools to measure and monitor frontend performance,
 * including component render times, API call durations, and user interactions.
 */

import { logger } from './logger';

const isDevelopment = import.meta.env.DEV;

/**
 * Performance metrics storage
 */
const metrics = {
  renders: [],
  apiCalls: [],
  interactions: [],
};

/**
 * Get performance mark name
 */
const getMarkName = (category, label) => `${category}-${label}`;

/**
 * Measure component render time
 * @param {string} componentName - Name of the component
 * @param {Function} callback - Function to measure
 * @returns {any} Result of the callback
 */
export const measureRender = (componentName, callback) => {
  if (!isDevelopment) return callback();

  const startMark = getMarkName('render-start', componentName);
  const endMark = getMarkName('render-end', componentName);
  const measureName = `render-${componentName}`;

  try {
    performance.mark(startMark);
    const result = callback();
    performance.mark(endMark);

    try {
      performance.measure(measureName, startMark, endMark);
      const measure = performance.getEntriesByName(measureName)[0];
      
      if (measure) {
        const duration = measure.duration;
        metrics.renders.push({
          component: componentName,
          duration,
          timestamp: Date.now(),
        });

        if (duration > 16) { // > 1 frame at 60fps
          logger.warn('Slow component render', { componentName, duration: duration.toFixed(2) + 'ms' });
        }

        // Clean up marks and measures
        performance.clearMarks(startMark);
        performance.clearMarks(endMark);
        performance.clearMeasures(measureName);
      }
    } catch (error) {
      // Ignore measure errors
    }

    return result;
  } catch (error) {
    logger.error('Failed to measure render', error);
    return callback();
  }
};

/**
 * Create a performance timer for async operations
 * @param {string} label - Label for the operation
 * @returns {Object} Timer object with start and end methods
 */
export const createTimer = (label) => {
  const startTime = performance.now();

  return {
    end: (metadata = {}) => {
      const endTime = performance.now();
      const duration = endTime - startTime;

      if (isDevelopment) {
        logger.debug(`Performance: ${label}`, { duration: duration.toFixed(2) + 'ms', ...metadata });
      }

      return duration;
    },
  };
};

/**
 * Measure API call performance
 * @param {string} endpoint - API endpoint
 * @param {Function} apiCall - Async API call function
 * @returns {Promise} Result of the API call
 */
export const measureAPICall = async (endpoint, apiCall) => {
  const timer = createTimer(`API: ${endpoint}`);

  try {
    const result = await apiCall();
    const duration = timer.end({ endpoint, status: 'success' });

    metrics.apiCalls.push({
      endpoint,
      duration,
      status: 'success',
      timestamp: Date.now(),
    });

    if (duration > 1000) { // > 1 second
      logger.warn('Slow API call', { endpoint, duration: duration.toFixed(2) + 'ms' });
    }

    return result;
  } catch (error) {
    const duration = timer.end({ endpoint, status: 'error' });

    metrics.apiCalls.push({
      endpoint,
      duration,
      status: 'error',
      timestamp: Date.now(),
    });

    throw error;
  }
};

/**
 * Measure user interaction performance
 * @param {string} action - Action name (e.g., 'button-click', 'form-submit')
 * @param {Function} handler - Event handler function
 * @returns {Function} Wrapped handler
 */
export const measureInteraction = (action, handler) => {
  return async (...args) => {
    const timer = createTimer(`Interaction: ${action}`);

    try {
      const result = await handler(...args);
      const duration = timer.end({ action, status: 'success' });

      metrics.interactions.push({
        action,
        duration,
        status: 'success',
        timestamp: Date.now(),
      });

      if (duration > 100) { // > 100ms for interaction
        logger.warn('Slow interaction', { action, duration: duration.toFixed(2) + 'ms' });
      }

      return result;
    } catch (error) {
      const duration = timer.end({ action, status: 'error' });

      metrics.interactions.push({
        action,
        duration,
        status: 'error',
        timestamp: Date.now(),
      });

      throw error;
    }
  };
};

/**
 * Get performance metrics summary
 * @returns {Object} Performance metrics
 */
export const getMetrics = () => {
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // Filter to recent metrics (last 5 minutes)
  const recentRenders = metrics.renders.filter(m => m.timestamp > fiveMinutesAgo);
  const recentApiCalls = metrics.apiCalls.filter(m => m.timestamp > fiveMinutesAgo);
  const recentInteractions = metrics.interactions.filter(m => m.timestamp > fiveMinutesAgo);

  const calculateStats = (arr, durationKey = 'duration') => {
    if (arr.length === 0) return { count: 0, avg: 0, min: 0, max: 0, total: 0 };

    const durations = arr.map(item => item[durationKey]);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      count: arr.length,
      avg: sum / arr.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      total: sum,
    };
  };

  return {
    renders: calculateStats(recentRenders),
    apiCalls: calculateStats(recentApiCalls),
    interactions: calculateStats(recentInteractions),
    slowRenders: recentRenders.filter(r => r.duration > 16).length,
    slowApiCalls: recentApiCalls.filter(a => a.duration > 1000).length,
    slowInteractions: recentInteractions.filter(i => i.duration > 100).length,
  };
};

/**
 * Clear all performance metrics
 */
export const clearMetrics = () => {
  metrics.renders = [];
  metrics.apiCalls = [];
  metrics.interactions = [];
};

/**
 * Log performance summary to console
 */
export const logPerformanceSummary = () => {
  if (!isDevelopment) return;

  const summary = getMetrics();

  console.group('📊 Performance Summary (Last 5 minutes)');
  
  console.group('🎨 Renders');
  console.log(`Count: ${summary.renders.count}`);
  console.log(`Average: ${summary.renders.avg.toFixed(2)}ms`);
  console.log(`Min: ${summary.renders.min.toFixed(2)}ms`);
  console.log(`Max: ${summary.renders.max.toFixed(2)}ms`);
  console.log(`Slow (>16ms): ${summary.slowRenders}`);
  console.groupEnd();

  console.group('🌐 API Calls');
  console.log(`Count: ${summary.apiCalls.count}`);
  console.log(`Average: ${summary.apiCalls.avg.toFixed(2)}ms`);
  console.log(`Min: ${summary.apiCalls.min.toFixed(2)}ms`);
  console.log(`Max: ${summary.apiCalls.max.toFixed(2)}ms`);
  console.log(`Slow (>1s): ${summary.slowApiCalls}`);
  console.groupEnd();

  console.group('👆 Interactions');
  console.log(`Count: ${summary.interactions.count}`);
  console.log(`Average: ${summary.interactions.avg.toFixed(2)}ms`);
  console.log(`Min: ${summary.interactions.min.toFixed(2)}ms`);
  console.log(`Max: ${summary.interactions.max.toFixed(2)}ms`);
  console.log(`Slow (>100ms): ${summary.slowInteractions}`);
  console.groupEnd();

  console.groupEnd();
};

/**
 * React hook to measure component mount/unmount time
 * @param {string} componentName - Name of the component
 */
export const usePerformanceMonitor = (componentName) => {
  if (!isDevelopment) return;

  React.useEffect(() => {
    const mountTime = performance.now();
    logger.debug(`Component mounted: ${componentName}`);

    return () => {
      const unmountTime = performance.now();
      const lifetime = unmountTime - mountTime;
      logger.debug(`Component unmounted: ${componentName}`, { lifetime: lifetime.toFixed(2) + 'ms' });
    };
  }, [componentName]);
};

/**
 * Measure Web Vitals (CLS, FID, LCP)
 * @returns {Promise<Object>} Web Vitals metrics
 */
export const measureWebVitals = async () => {
  if (!('PerformanceObserver' in window)) {
    logger.warn('PerformanceObserver not supported');
    return null;
  }

  const vitals = {
    CLS: null, // Cumulative Layout Shift
    FID: null, // First Input Delay
    LCP: null, // Largest Contentful Paint
  };

  try {
    // LCP
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      vitals.LCP = lastEntry.renderTime || lastEntry.loadTime;
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // FID
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        vitals.FID = entry.processingStart - entry.startTime;
      });
    });
    fidObserver.observe({ entryTypes: ['first-input'] });

    // CLS
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      vitals.CLS = clsValue;
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });

    logger.debug('Web Vitals monitoring started');
  } catch (error) {
    logger.error('Failed to measure Web Vitals', error);
  }

  return vitals;
};

/**
 * Expose performance summary to window for debugging
 */
if (isDevelopment && typeof window !== 'undefined') {
  window.__performanceMetrics = {
    getMetrics,
    clearMetrics,
    logSummary: logPerformanceSummary,
  };
}

export default {
  measureRender,
  createTimer,
  measureAPICall,
  measureInteraction,
  getMetrics,
  clearMetrics,
  logPerformanceSummary,
  usePerformanceMonitor,
  measureWebVitals,
};

