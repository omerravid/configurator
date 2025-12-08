/**
 * Accessibility Utilities
 * 
 * Provides utilities and hooks for improving application accessibility (a11y).
 * Includes keyboard navigation, focus management, ARIA helpers, and screen reader support.
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Trap focus within a container (e.g., modals, dialogs)
 * @param {RefObject} containerRef - Reference to the container element
 * @param {boolean} active - Whether focus trap is active
 */
export const useFocusTrap = (containerRef, active = true) => {
  useEffect(() => {
    if (!active || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key !== 'Tab') {
        return;
      }

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // Focus first element when trap activates
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [containerRef, active]);
};

/**
 * Restore focus to previous element when component unmounts
 * Useful for modals/dialogs
 */
export const useFocusReturn = () => {
  const previousActiveElement = useRef(null);

  useEffect(() => {
    previousActiveElement.current = document.activeElement;

    return () => {
      if (previousActiveElement.current && previousActiveElement.current.focus) {
        previousActiveElement.current.focus();
      }
    };
  }, []);
};

/**
 * Handle keyboard navigation for lists
 * @param {Array} items - Array of items
 * @param {number} selectedIndex - Currently selected index
 * @param {Function} onSelect - Callback when item is selected
 * @returns {Object} Keyboard event handler and helpers
 */
export const useKeyboardNavigation = (items, selectedIndex, onSelect) => {
  const handleKeyDown = useCallback(
    (e) => {
      const { key } = e;

      switch (key) {
        case 'ArrowDown':
        case 'Down':
          e.preventDefault();
          if (selectedIndex < items.length - 1) {
            onSelect(selectedIndex + 1);
          }
          break;

        case 'ArrowUp':
        case 'Up':
          e.preventDefault();
          if (selectedIndex > 0) {
            onSelect(selectedIndex - 1);
          }
          break;

        case 'Home':
          e.preventDefault();
          onSelect(0);
          break;

        case 'End':
          e.preventDefault();
          onSelect(items.length - 1);
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < items.length) {
            // Trigger selection action
            const item = items[selectedIndex];
            if (item.onClick) {
              item.onClick();
            }
          }
          break;

        default:
          break;
      }
    },
    [items, selectedIndex, onSelect]
  );

  return { handleKeyDown };
};

/**
 * Announce message to screen readers
 * @param {string} message - Message to announce
 * @param {string} priority - 'polite' or 'assertive'
 */
export const announceToScreenReader = (message, priority = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only'; // Visually hidden
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Generate unique ID for ARIA relationships
 * @param {string} prefix - Prefix for the ID
 * @returns {string} Unique ID
 */
let idCounter = 0;
export const useUniqueId = (prefix = 'a11y') => {
  const idRef = useRef(null);

  if (idRef.current === null) {
    idRef.current = `${prefix}-${++idCounter}`;
  }

  return idRef.current;
};

/**
 * Skip to content link - allows keyboard users to skip navigation
 * @param {string} targetId - ID of main content area
 */
export const SkipToContent = ({ targetId = 'main-content' }) => {
  const handleClick = (e) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.scrollIntoView();
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-md"
    >
      Skip to main content
    </a>
  );
};

/**
 * ARIA live region component for dynamic content
 */
export const LiveRegion = ({ message, priority = 'polite', children }) => {
  return (
    <div role="status" aria-live={priority} aria-atomic="true" className="sr-only">
      {message || children}
    </div>
  );
};

/**
 * Get ARIA props for expandable sections
 * @param {boolean} expanded - Whether section is expanded
 * @param {string} id - Unique ID for the content
 * @returns {Object} ARIA props for button and content
 */
export const getExpandableProps = (expanded, id) => {
  return {
    button: {
      'aria-expanded': expanded,
      'aria-controls': id,
    },
    content: {
      id,
      role: 'region',
      'aria-hidden': !expanded,
    },
  };
};

/**
 * Check if element is visible to user (for accessibility)
 * @param {HTMLElement} element - Element to check
 * @returns {boolean} True if visible
 */
export const isElementVisible = (element) => {
  if (!element) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    element.offsetParent !== null
  );
};

/**
 * Get all focusable elements within a container
 * @param {HTMLElement} container - Container element
 * @returns {Array} Array of focusable elements
 */
export const getFocusableElements = (container) => {
  if (!container) {
    return [];
  }

  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors)).filter(
    isElementVisible
  );
};

/**
 * Escape key handler hook
 * @param {Function} callback - Function to call on Escape key
 * @param {boolean} enabled - Whether handler is enabled
 */
export const useEscapeKey = (callback, enabled = true) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleEscape = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        callback(e);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [callback, enabled]);
};

/**
 * Visually hidden styles for screen-reader-only content
 * Add to your CSS:
 */
export const visuallyHiddenStyles = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export default {
  useFocusTrap,
  useFocusReturn,
  useKeyboardNavigation,
  useEscapeKey,
  useUniqueId,
  announceToScreenReader,
  getExpandableProps,
  getFocusableElements,
  isElementVisible,
  SkipToContent,
  LiveRegion,
  visuallyHiddenStyles,
};

