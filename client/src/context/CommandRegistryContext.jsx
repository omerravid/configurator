import React, { createContext, useContext, useState, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * Command Registry Context
 * 
 * Provides a centralized registry for application commands that can be
 * accessed via the command palette.
 */

const CommandRegistryContext = createContext(null);

export const useCommandRegistry = () => {
  const context = useContext(CommandRegistryContext);
  if (!context) {
    throw new Error('useCommandRegistry must be used within CommandRegistryProvider');
  }
  return context;
};

export const CommandRegistryProvider = ({ children }) => {
  const [commands, setCommands] = useState([]);

  /**
   * Register commands
   * @param {Array} newCommands - Array of command objects
   */
  const registerCommands = useCallback((newCommands) => {
    setCommands(prev => {
      // Remove duplicates by id, keep the newest
      const commandMap = new Map(prev.map(cmd => [cmd.id, cmd]));
      newCommands.forEach(cmd => commandMap.set(cmd.id, cmd));
      return Array.from(commandMap.values());
    });
  }, []);

  /**
   * Unregister commands by ids
   * @param {Array} commandIds - Array of command IDs to remove
   */
  const unregisterCommands = useCallback((commandIds) => {
    setCommands(prev => prev.filter(cmd => !commandIds.includes(cmd.id)));
  }, []);

  /**
   * Clear all commands
   */
  const clearCommands = useCallback(() => {
    setCommands([]);
  }, []);

  /**
   * Get all registered commands
   */
  const getAllCommands = useCallback(() => {
    return commands;
  }, [commands]);

  const value = {
    commands,
    registerCommands,
    unregisterCommands,
    clearCommands,
    getAllCommands,
  };

  return (
    <CommandRegistryContext.Provider value={value}>
      {children}
    </CommandRegistryContext.Provider>
  );
};

CommandRegistryProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to register commands for a component
 * Commands are automatically unregistered when component unmounts
 */
export const useRegisterCommands = (commands) => {
  const { registerCommands, unregisterCommands } = useCommandRegistry();

  React.useEffect(() => {
    if (commands && commands.length > 0) {
      registerCommands(commands);

      // Cleanup on unmount
      return () => {
        const commandIds = commands.map(cmd => cmd.id);
        unregisterCommands(commandIds);
      };
    }
  }, [commands, registerCommands, unregisterCommands]);
};

export default CommandRegistryProvider;

