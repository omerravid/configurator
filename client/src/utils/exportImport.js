/**
 * Export/Import Utilities
 * 
 * Handles exporting configurations to JSON files and importing them back.
 */

import { logger } from './logger';

/**
 * Export configurations to JSON file
 * @param {Array} configurations - Array of configuration objects to export
 * @param {string} filename - Optional filename (defaults to timestamp-based name)
 */
export const exportConfigurations = (configurations, filename = null) => {
  try {
    if (!configurations || configurations.length === 0) {
      throw new Error('No configurations to export');
    }

    // Generate filename if not provided
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const defaultFilename = `configurations-export-${timestamp}.json`;
    const finalFilename = filename || defaultFilename;

    // Prepare export data with metadata
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: configurations.length,
      configurations: configurations.map(config => {
        // Ensure data is a plain object, not undefined or null
        let configData = config.data;
        if (configData === undefined || configData === null) {
          configData = {};
        } else if (typeof configData === 'string') {
          // If data is a string, try to parse it
          try {
            configData = JSON.parse(configData);
          } catch (e) {
            logger.warn('Failed to parse config data, using empty object', { name: config.name });
            configData = {};
          }
        } else if (typeof configData !== 'object' || Array.isArray(configData)) {
          logger.warn('Invalid config data type, using empty object', { name: config.name, type: typeof configData });
          configData = {};
        }

        return {
          name: config.name,
          type: config.type,
          description: config.description || '',
          parent_id: config.parent_id || null,
          parent_name: config.parent_name || null,
          data: configData,
          status: config.status || 'DRAFT',
          created_by: config.created_by,
          created_by_username: config.created_by_username,
          archived: Boolean(config.archived),
          // Exclude internal IDs and timestamps for portability
          // id, created_at, updated_at will be regenerated on import
        };
      }),
    };

    // Convert to JSON string with pretty formatting
    const jsonString = JSON.stringify(exportData, null, 2);

    // Create blob and download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('Configurations exported successfully', {
      count: configurations.length,
      filename: finalFilename,
    });

    return {
      success: true,
      filename: finalFilename,
      count: configurations.length,
    };
  } catch (error) {
    logger.error('Failed to export configurations', error);
    throw error;
  }
};

/**
 * Export single configuration to JSON file
 * @param {Object} configuration - Configuration object to export
 * @param {string} filename - Optional filename
 */
export const exportSingleConfiguration = (configuration, filename = null) => {
  if (!configuration) {
    throw new Error('No configuration provided');
  }

  logger.debug('Exporting single configuration', {
    name: configuration.name,
    type: configuration.type,
    hasData: !!configuration.data,
  });

  const sanitizedName = configuration.name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const defaultFilename = `${sanitizedName}-export.json`;
  
  return exportConfigurations([configuration], filename || defaultFilename);
};

/**
 * Validate imported configuration data
 * @param {Object} data - Imported JSON data
 * @returns {Object} Validation result with errors array
 */
export const validateImportData = (data) => {
  const errors = [];

  // Check if data exists
  if (!data) {
    errors.push('No data provided');
    return { valid: false, errors };
  }

  // Debug logging
  logger.debug('Validating import data', {
    hasData: !!data,
    dataType: typeof data,
    hasConfigurations: 'configurations' in data,
    configurationsType: typeof data.configurations,
    isArray: Array.isArray(data.configurations),
    keys: Object.keys(data),
  });

  // Check version
  if (!data.version) {
    errors.push('Missing version field');
  }

  // Check configurations array
  if (!Array.isArray(data.configurations)) {
    errors.push(`configurations must be an array (got ${typeof data.configurations})`);
    return { valid: false, errors };
  }

  if (data.configurations.length === 0) {
    errors.push('No configurations found in import file');
    return { valid: false, errors };
  }

  // Validate each configuration
  data.configurations.forEach((config, index) => {
    const configErrors = [];

    // Required fields
    if (!config.name || typeof config.name !== 'string') {
      configErrors.push('missing or invalid name');
    }

    if (!config.type || !['PRODUCT', 'COMPONENT', 'VERSION', 'INSTANCE', 'USER'].includes(config.type)) {
      configErrors.push('missing or invalid type');
    }

    // Data field validation
    if (config.data !== undefined && typeof config.data !== 'object') {
      configErrors.push('data must be an object');
    }

    if (configErrors.length > 0) {
      errors.push(`Configuration ${index + 1} (${config.name || 'unnamed'}): ${configErrors.join(', ')}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    count: data.configurations.length,
  };
};

/**
 * Parse and validate imported JSON file
 * @param {File} file - File object from input
 * @returns {Promise<Object>} Parsed and validated data
 */
export const parseImportFile = async (file) => {
  return new Promise((resolve, reject) => {
    // Check file type
    if (!file.name.endsWith('.json')) {
      reject(new Error('File must be a JSON file (.json)'));
      return;
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      reject(new Error('File size exceeds 10MB limit'));
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const jsonData = JSON.parse(event.target.result);
        
        // Validate the parsed data
        const validation = validateImportData(jsonData);
        
        if (!validation.valid) {
          reject(new Error(`Validation failed:\n${validation.errors.join('\n')}`));
          return;
        }

        logger.info('Import file parsed successfully', {
          filename: file.name,
          count: jsonData.configurations.length,
        });

        resolve({
          data: jsonData,
          validation,
        });
      } catch (error) {
        if (error instanceof SyntaxError) {
          reject(new Error('Invalid JSON format'));
        } else {
          reject(error);
        }
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Prepare configurations for import (remove IDs, adjust names if conflicts)
 * @param {Array} configurations - Configurations to import
 * @param {Array} existingConfigurations - Existing configurations to check for conflicts
 * @param {Object} options - Import options
 * @returns {Array} Prepared configurations
 */
export const prepareConfigurationsForImport = (
  configurations,
  existingConfigurations = [],
  options = {}
) => {
  const {
    renameOnConflict = true,
    preserveStatus = false,
    setAsDraft = true,
  } = options;

  const existingNames = new Set(existingConfigurations.map(c => c.name));

  return configurations.map(config => {
    let name = config.name;

    // Handle name conflicts
    if (existingNames.has(name) && renameOnConflict) {
      let counter = 1;
      let newName = `${name}_imported`;
      
      while (existingNames.has(newName)) {
        counter++;
        newName = `${name}_imported_${counter}`;
      }
      
      name = newName;
      logger.info('Renamed configuration to avoid conflict', {
        originalName: config.name,
        newName: name,
      });
    }

    // Prepare clean configuration object
    const prepared = {
      name,
      type: config.type,
      description: config.description || `Imported from ${config.name}`,
      data: config.data || {},
      // parent_id will be null - user must reassign if needed
      parent_id: null,
    };

    // Handle status
    if (!setAsDraft && preserveStatus && config.status) {
      prepared.status = config.status;
    }
    // Otherwise, backend will default to DRAFT for USER type

    return prepared;
  });
};

/**
 * Generate import summary report
 * @param {Array} imported - Successfully imported configurations
 * @param {Array} failed - Failed configuration imports
 * @returns {Object} Summary report
 */
export const generateImportSummary = (imported, failed) => {
  return {
    total: imported.length + failed.length,
    successCount: imported.length,
    failureCount: failed.length,
    imported: imported.map(c => ({
      name: c.name,
      type: c.type,
      id: c.id,
    })),
    failed: failed.map(f => ({
      name: f.config.name,
      error: f.error,
    })),
  };
};
