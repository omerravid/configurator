import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { MagnifyingGlassIcon, CommandLineIcon } from '@heroicons/react/24/outline';
import { useFocusTrap } from '../utils/accessibility';
import { getAllShortcuts, getShortcutsByCategory, formatKeys } from '../utils/shortcuts';

/**
 * Command Palette Component
 * 
 * Quick access to all application commands and shortcuts.
 * Inspired by VS Code, Slack, Linear, etc.
 */

const CommandPalette = ({ isOpen, onClose, commands = [], onExecute }) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const paletteRef = useRef(null);
  const inputRef = useRef(null);

  useFocusTrap(paletteRef, isOpen);

  // Filter commands based on search
  const filteredCommands = commands.filter(cmd => {
    if (!search) {
      return true;
    }
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.category?.toLowerCase().includes(searchLower)
    );
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'General';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cmd);
    return acc;
  }, {});

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handler = (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            handleExecute(filteredCommands[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, filteredCommands, selectedIndex]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleExecute = (command) => {
    if (command.action) {
      command.action();
    }
    if (onExecute) {
      onExecute(command);
    }
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 fade-in"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 z-50 overflow-y-auto pt-[20vh] px-4">
        <div
          ref={paletteRef}
          className="relative mx-auto max-w-2xl transform rounded-lg bg-white dark:bg-gray-800 shadow-2xl transition-all scale-in"
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedIndex(0);
              }}
              className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded">
              ESC
            </kbd>
          </div>

          {/* Command List */}
          <div className="max-h-96 overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                No commands found for "{search}"
              </div>
            ) : (
              Object.entries(groupedCommands).map(([category, cmds]) => (
                <div key={category} className="mb-4">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {cmds.map((cmd, index) => {
                      const globalIndex = filteredCommands.indexOf(cmd);
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <button
                          key={cmd.id || index}
                          onClick={() => handleExecute(cmd)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors
                            ${isSelected ? 'bg-primary-100 dark:bg-primary-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                          `}
                        >
                          {cmd.icon && (
                            <cmd.icon className={`h-5 w-5 flex-shrink-0 ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${isSelected ? 'text-primary-900 dark:text-primary-100' : 'text-gray-900 dark:text-gray-100'}`}>
                              {cmd.label}
                            </div>
                            {cmd.description && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {cmd.description}
                              </div>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400 rounded">
                              {formatKeys(cmd.shortcut)}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">↵</kbd>
                Select
              </span>
            </div>
            <span>{filteredCommands.length} commands</span>
          </div>
        </div>
      </div>
    </>
  );
};

CommandPalette.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  commands: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string.isRequired,
    description: PropTypes.string,
    category: PropTypes.string,
    shortcut: PropTypes.string,
    icon: PropTypes.elementType,
    action: PropTypes.func,
  })).isRequired,
  onExecute: PropTypes.func,
};

/**
 * Keyboard Shortcuts Help Dialog
 */
export const ShortcutsHelpDialog = ({ isOpen, onClose }) => {
  const shortcuts = getShortcutsByCategory();

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden scale-in">
            {/* Header */}
            <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CommandLineIcon className="h-6 w-6" />
                  Keyboard Shortcuts
                </h2>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="Close"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Shortcuts List */}
            <div className="overflow-y-auto p-6 max-h-[calc(80vh-120px)]">
              {Object.entries(shortcuts).map(([category, categoryShortcuts]) => (
                <div key={category} className="mb-6 last:mb-0">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {categoryShortcuts.map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {shortcut.description || shortcut.keys}
                        </span>
                        <kbd className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
                          {formatKeys(shortcut.keys)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {Object.keys(shortcuts).length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  No keyboard shortcuts registered
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Press <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">?</kbd> to toggle this dialog
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

ShortcutsHelpDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default CommandPalette;


