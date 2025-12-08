/**
 * Keyboard Shortcuts System
 * 
 * Provides a centralized system for registering and handling keyboard shortcuts
 * with visual feedback and help dialog.
 */

import { useEffect, useCallback, useRef } from 'react';
import { logger } from './logger';

/**
 * Keyboard shortcut registry
 */
class ShortcutRegistry {
  constructor() {
    this.shortcuts = new Map();
    this.enabled = true;
  }

  /**
   * Register a keyboard shortcut
   * @param {string} keys - Key combination (e.g., 'ctrl+s', 'cmd+k')
   * @param {Function} handler - Function to call when triggered
   * @param {Object} options - Additional options
   */
  register(keys, handler, options = {}) {
    const normalized = this.normalizeKeys(keys);
    
    this.shortcuts.set(normalized, {
      keys: normalized,
      handler,
      description: options.description || '',
      category: options.category || 'General',
      enabled: options.enabled !== false,
      preventDefault: options.preventDefault !== false,
    });

    logger.debug('Keyboard shortcut registered', { keys: normalized });
  }

  /**
   * Unregister a keyboard shortcut
   * @param {string} keys - Key combination to unregister
   */
  unregister(keys) {
    const normalized = this.normalizeKeys(keys);
    const deleted = this.shortcuts.delete(normalized);
    
    if (deleted) {
      logger.debug('Keyboard shortcut unregistered', { keys: normalized });
    }
    
    return deleted;
  }

  /**
   * Normalize key combination string
   * @param {string} keys - Raw key combination
   * @returns {string} Normalized key combination
   */
  normalizeKeys(keys) {
    return keys
      .toLowerCase()
      .split('+')
      .map(k => k.trim())
      .sort()
      .join('+');
  }

  /**
   * Check if event matches a shortcut
   * @param {KeyboardEvent} event - Keyboard event
   * @returns {Object|null} Matching shortcut or null
   */
  match(event) {
    if (!this.enabled) {
      return null;
    }

    // Build key combination from event
    const keys = [];
    
    if (event.ctrlKey || event.metaKey) {
      keys.push(event.ctrlKey ? 'ctrl' : 'cmd');
    }
    if (event.altKey) {
      keys.push('alt');
    }
    if (event.shiftKey) {
      keys.push('shift');
    }
    
    // Add the actual key
    const key = event.key.toLowerCase();
    if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
      keys.push(key);
    }

    const combination = keys.sort().join('+');

    // Find matching shortcut
    for (const [shortcutKeys, shortcut] of this.shortcuts.entries()) {
      if (shortcutKeys === combination && shortcut.enabled) {
        return shortcut;
      }
    }

    return null;
  }

  /**
   * Get all registered shortcuts
   * @returns {Array} Array of shortcuts
   */
  getAll() {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   * @param {string} category - Category name
   * @returns {Array} Array of shortcuts in category
   */
  getByCategory(category) {
    return this.getAll().filter(s => s.category === category);
  }

  /**
   * Enable/disable all shortcuts
   * @param {boolean} enabled - Whether shortcuts are enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    logger.debug('Keyboard shortcuts', { enabled });
  }

  /**
   * Clear all shortcuts
   */
  clear() {
    this.shortcuts.clear();
  }
}

// Global registry instance
const globalRegistry = new ShortcutRegistry();

/**
 * React hook for keyboard shortcuts
 * @param {Object} shortcuts - Shortcut definitions
 * @param {Array} deps - Dependencies array
 */
export const useKeyboardShortcuts = (shortcuts, deps = []) => {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    const handler = (event) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target;
      const tagName = target.tagName.toLowerCase();
      
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        // Allow some shortcuts even in inputs (like Escape)
        if (event.key !== 'Escape') {
          return;
        }
      }

      const shortcut = globalRegistry.match(event);
      
      if (shortcut) {
        if (shortcut.preventDefault) {
          event.preventDefault();
        }
        
        try {
          shortcut.handler(event);
          logger.debug('Keyboard shortcut triggered', { keys: shortcut.keys });
        } catch (error) {
          logger.error('Keyboard shortcut handler failed', error);
        }
      }
    };

    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, deps);
};

/**
 * Register keyboard shortcuts (component-scoped)
 * @param {Object} shortcuts - Map of key combinations to handlers
 * @param {Object} options - Global options
 */
export const useShortcuts = (shortcuts, options = {}) => {
  useEffect(() => {
    // Register all shortcuts
    Object.entries(shortcuts).forEach(([keys, config]) => {
      const handler = typeof config === 'function' ? config : config.handler;
      const opts = typeof config === 'object' ? config : {};
      
      globalRegistry.register(keys, handler, { ...options, ...opts });
    });

    // Cleanup: unregister on unmount
    return () => {
      Object.keys(shortcuts).forEach(keys => {
        globalRegistry.unregister(keys);
      });
    };
  }, [shortcuts, options]);
};

/**
 * Get all registered shortcuts
 * @returns {Array} Array of shortcuts
 */
export const getAllShortcuts = () => {
  return globalRegistry.getAll();
};

/**
 * Get shortcuts grouped by category
 * @returns {Object} Shortcuts grouped by category
 */
export const getShortcutsByCategory = () => {
  const all = globalRegistry.getAll();
  const grouped = {};

  all.forEach(shortcut => {
    const category = shortcut.category || 'General';
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(shortcut);
  });

  return grouped;
};

/**
 * Enable or disable shortcuts globally
 * @param {boolean} enabled - Whether shortcuts are enabled
 */
export const setShortcutsEnabled = (enabled) => {
  globalRegistry.setEnabled(enabled);
};

/**
 * Format key combination for display
 * @param {string} keys - Key combination
 * @returns {string} Formatted keys for display
 */
export const formatKeys = (keys) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  
  return keys
    .split('+')
    .map(key => {
      switch (key.toLowerCase()) {
        case 'ctrl':
          return isMac ? '⌃' : 'Ctrl';
        case 'cmd':
        case 'meta':
          return isMac ? '⌘' : 'Win';
        case 'alt':
          return isMac ? '⌥' : 'Alt';
        case 'shift':
          return isMac ? '⇧' : 'Shift';
        case 'enter':
          return '↵';
        case 'escape':
        case 'esc':
          return 'Esc';
        case 'backspace':
          return '⌫';
        case 'delete':
          return 'Del';
        case 'arrowup':
          return '↑';
        case 'arrowdown':
          return '↓';
        case 'arrowleft':
          return '←';
        case 'arrowright':
          return '→';
        default:
          return key.charAt(0).toUpperCase() + key.slice(1);
      }
    })
    .join(isMac ? '' : '+');
};

/**
 * Common keyboard shortcuts
 */
export const SHORTCUTS = {
  // Navigation
  SEARCH: 'ctrl+k',
  HELP: '?',
  SETTINGS: 'ctrl+,',
  
  // Actions
  SAVE: 'ctrl+s',
  NEW: 'ctrl+n',
  DELETE: 'ctrl+d',
  DUPLICATE: 'ctrl+shift+d',
  REFRESH: 'ctrl+r',
  
  // Editing
  UNDO: 'ctrl+z',
  REDO: 'ctrl+shift+z',
  COPY: 'ctrl+c',
  PASTE: 'ctrl+v',
  
  // UI
  TOGGLE_SIDEBAR: 'ctrl+b',
  TOGGLE_THEME: 'ctrl+shift+l',
  CLOSE: 'escape',
};

/**
 * Expose shortcuts to window for debugging
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__keyboardShortcuts = {
    getAll: getAllShortcuts,
    getByCategory: getShortcutsByCategory,
    setEnabled: setShortcutsEnabled,
  };
}

export default {
  useKeyboardShortcuts,
  useShortcuts,
  getAllShortcuts,
  getShortcutsByCategory,
  setShortcutsEnabled,
  formatKeys,
  SHORTCUTS,
};

