import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { getAllShortcuts, formatKeys } from '../utils/shortcuts';

/**
 * Keyboard Shortcuts Test Component
 * 
 * Displays all registered shortcuts and listens for keyboard events
 * to show which shortcut was triggered.
 */
const ShortcutsTest = ({ onClose }) => {
  const [lastTriggered, setLastTriggered] = useState(null);
  const [allShortcuts, setAllShortcuts] = useState([]);

  useEffect(() => {
    // Get all registered shortcuts
    const shortcuts = getAllShortcuts();
    setAllShortcuts(shortcuts);
  }, []);

  useEffect(() => {
    // Listen for any keydown to show what was pressed
    const handler = (e) => {
      const keys = [];
      if (e.ctrlKey || e.metaKey) keys.push(e.ctrlKey ? 'Ctrl' : 'Cmd');
      if (e.altKey) keys.push('Alt');
      if (e.shiftKey) keys.push('Shift');
      
      const key = e.key;
      if (key !== 'Control' && key !== 'Alt' && key !== 'Shift' && key !== 'Meta') {
        keys.push(key);
      }

      if (keys.length > 0) {
        setLastTriggered({
          keys: keys.join('+'),
          timestamp: Date.now(),
        });
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Clear last triggered after 3 seconds
  useEffect(() => {
    if (lastTriggered) {
      const timer = setTimeout(() => setLastTriggered(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastTriggered]);

  // Group shortcuts by category
  const groupedShortcuts = allShortcuts.reduce((acc, shortcut) => {
    const category = shortcut.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(shortcut);
    return acc;
  }, {});

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-md max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          ⌨️ Keyboard Shortcuts Test
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Last Triggered Display */}
      {lastTriggered && (
        <div className="mb-4 p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
          <div className="text-xs font-medium text-primary-700 dark:text-primary-300 mb-1">
            Last Key Pressed:
          </div>
          <div className="text-lg font-bold text-primary-900 dark:text-primary-100">
            {lastTriggered.keys}
          </div>
        </div>
      )}

      {/* Registered Shortcuts */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
          Registered Shortcuts: {allShortcuts.length}
        </div>

        {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
          <div key={category} className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              {category}
            </div>
            <div className="space-y-1">
              {shortcuts.map((shortcut, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {shortcut.description || shortcut.keys}
                  </span>
                  <kbd className="px-2 py-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                    {formatKeys(shortcut.keys)}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <strong>Test Instructions:</strong>
          <br />
          1. Press any registered shortcut
          <br />
          2. Verify the action occurs
          <br />
          3. Type in an input field - shortcuts should NOT trigger
          <br />
          4. Press <kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">?</kbd> to see help dialog
        </p>
      </div>
    </div>
  );
};

ShortcutsTest.propTypes = {
  onClose: PropTypes.func,
};

export default ShortcutsTest;

