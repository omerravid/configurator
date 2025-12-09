import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useShortcuts, SHORTCUTS } from '../utils/shortcuts';
import { ShortcutsHelpDialog } from './CommandPalette';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import { logger } from '../utils/logger';

/**
 * Global Keyboard Shortcuts Handler
 * 
 * Registers and manages application-wide keyboard shortcuts.
 * Provides shortcuts for:
 * - Opening command palette
 * - Showing shortcuts help
 * - Toggling theme
 * - Navigation and common actions
 */
const GlobalShortcuts = ({ 
  onOpenCommandPalette, 
  onOpenSettings,
  onRefresh,
  children 
}) => {
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { toggleTheme } = useTheme();
  const notifications = useNotifications();

  // Register global shortcuts
  useShortcuts({
    // Command Palette
    [SHORTCUTS.SEARCH]: {
      handler: () => {
        logger.debug('Shortcut triggered', { shortcut: 'SEARCH' });
        if (onOpenCommandPalette) {
          onOpenCommandPalette();
        }
      },
      description: 'Open command palette',
      category: 'Navigation',
    },

    // Help
    '?': {
      handler: () => {
        logger.debug('Shortcut triggered', { shortcut: 'HELP' });
        setShowShortcutsHelp(true);
      },
      description: 'Show keyboard shortcuts',
      category: 'Help',
    },

    // Settings
    [SHORTCUTS.SETTINGS]: {
      handler: () => {
        logger.debug('Shortcut triggered', { shortcut: 'SETTINGS' });
        if (onOpenSettings) {
          onOpenSettings();
        } else {
          notifications.info('Settings', {
            message: 'Settings shortcut available in Dashboard',
          });
        }
      },
      description: 'Open settings',
      category: 'Navigation',
    },

    // Theme Toggle
    [SHORTCUTS.TOGGLE_THEME]: {
      handler: () => {
        logger.debug('Shortcut triggered', { shortcut: 'TOGGLE_THEME' });
        toggleTheme();
        notifications.success('Theme toggled', {
          duration: 2000,
        });
      },
      description: 'Toggle dark/light theme',
      category: 'UI',
    },

    // Refresh
    [SHORTCUTS.REFRESH]: {
      handler: (e) => {
        logger.debug('Shortcut triggered', { shortcut: 'REFRESH' });
        if (onRefresh) {
          onRefresh();
        } else {
          // Default browser refresh behavior
          window.location.reload();
        }
      },
      description: 'Refresh current view',
      category: 'Actions',
      preventDefault: true, // Override default browser refresh
    },

    // Close/Escape (handled contextually, but registered globally)
    [SHORTCUTS.CLOSE]: {
      handler: () => {
        logger.debug('Shortcut triggered', { shortcut: 'ESCAPE' });
        // Close shortcuts help if open
        if (showShortcutsHelp) {
          setShowShortcutsHelp(false);
        }
        // Other escape handlers will be contextual (dialogs, modals, etc.)
      },
      description: 'Close dialogs and modals',
      category: 'UI',
      preventDefault: false, // Allow default escape behavior
    },
  });

  return (
    <>
      {children}
      
      {/* Shortcuts Help Dialog */}
      <ShortcutsHelpDialog
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
};

GlobalShortcuts.propTypes = {
  onOpenCommandPalette: PropTypes.func,
  onOpenSettings: PropTypes.func,
  onRefresh: PropTypes.func,
  children: PropTypes.node.isRequired,
};

export default GlobalShortcuts;

