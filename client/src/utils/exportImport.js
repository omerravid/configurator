import { logger } from './logger';

/**
 * Export/Import Utilities
 * 
 * Provides functionality for exporting and importing data in various formats:
 * - JSON
 * - CSV
 * - Excel (XLSX)
 * - Configuration files
 */

/**
 * Export data to JSON file
 * @param {any} data - Data to export
 * @param {string} filename - Filename without extension
 */
export const exportToJSON = (data, filename = 'export') => {
  try {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    downloadBlob(blob, `${filename}.json`);
    
    logger.info('Data exported to JSON', { filename });
    return true;
  } catch (error) {
    logger.error('Failed to export JSON', error);
    throw error;
  }
};

/**
 * Export data to CSV file
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Filename without extension
 * @param {Object} options - Export options
 */
export const exportToCSV = (data, filename = 'export', options = {}) => {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array');
    }

    const {
      delimiter = ',',
      includeHeaders = true,
      columns = null, // Specific columns to export
    } = options;

    // Get column names
    const columnNames = columns || Object.keys(data[0]);

    // Build CSV string
    let csv = '';

    // Add headers
    if (includeHeaders) {
      csv += columnNames.map(col => escapeCSV(col)).join(delimiter) + '\n';
    }

    // Add rows
    data.forEach(row => {
      const values = columnNames.map(col => {
        const value = getNestedValue(row, col);
        return escapeCSV(value);
      });
      csv += values.join(delimiter) + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);

    logger.info('Data exported to CSV', { filename, rows: data.length });
    return true;
  } catch (error) {
    logger.error('Failed to export CSV', error);
    throw error;
  }
};

/**
 * Export data to Excel-compatible format (CSV with UTF-8 BOM)
 * @param {Array} data - Array of objects to export
 * @param {string} filename - Filename without extension
 * @param {Object} options - Export options
 */
export const exportToExcel = (data, filename = 'export', options = {}) => {
  try {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array');
    }

    const {
      delimiter = ',',
      includeHeaders = true,
      columns = null,
    } = options;

    const columnNames = columns || Object.keys(data[0]);

    let csv = '';

    if (includeHeaders) {
      csv += columnNames.map(col => escapeCSV(col)).join(delimiter) + '\n';
    }

    data.forEach(row => {
      const values = columnNames.map(col => {
        const value = getNestedValue(row, col);
        return escapeCSV(value);
      });
      csv += values.join(delimiter) + '\n';
    });

    // Add UTF-8 BOM for Excel
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `${filename}.csv`);

    logger.info('Data exported to Excel CSV', { filename, rows: data.length });
    return true;
  } catch (error) {
    logger.error('Failed to export Excel', error);
    throw error;
  }
};

/**
 * Export configuration to file
 * @param {Object} config - Configuration object
 * @param {string} filename - Filename
 * @param {string} format - Format (json, yaml, toml)
 */
export const exportConfiguration = (config, filename, format = 'json') => {
  try {
    let content;
    let mimeType;
    let extension;

    switch (format.toLowerCase()) {
      case 'json':
        content = JSON.stringify(config, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
      
      case 'yaml':
      case 'yml':
        // Simple YAML conversion (for complex YAML, use a library)
        content = objectToYAML(config);
        mimeType = 'text/yaml';
        extension = 'yml';
        break;
      
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    const blob = new Blob([content], { type: mimeType });
    const finalFilename = filename.includes('.') ? filename : `${filename}.${extension}`;
    downloadBlob(blob, finalFilename);

    logger.info('Configuration exported', { filename: finalFilename, format });
    return true;
  } catch (error) {
    logger.error('Failed to export configuration', error);
    throw error;
  }
};

/**
 * Import data from JSON file
 * @param {File} file - File object
 * @returns {Promise<any>} Parsed data
 */
export const importFromJSON = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        logger.info('Data imported from JSON', { filename: file.name });
        resolve(data);
      } catch (error) {
        logger.error('Failed to parse JSON', error);
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => {
      logger.error('Failed to read file', { filename: file.name });
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Import data from CSV file
 * @param {File} file - File object
 * @param {Object} options - Import options
 * @returns {Promise<Array>} Parsed data
 */
export const importFromCSV = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const {
          delimiter = ',',
          hasHeaders = true,
          skipEmptyLines = true,
        } = options;

        const text = e.target.result;
        const lines = text.split('\n');

        if (lines.length === 0) {
          reject(new Error('Empty CSV file'));
          return;
        }

        // Parse headers
        let headers;
        let startIndex = 0;

        if (hasHeaders) {
          headers = parseCSVLine(lines[0], delimiter);
          startIndex = 1;
        } else {
          // Generate column names
          const firstLine = parseCSVLine(lines[0], delimiter);
          headers = firstLine.map((_, i) => `column_${i + 1}`);
        }

        // Parse rows
        const data = [];
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          
          if (skipEmptyLines && !line) {
            continue;
          }

          const values = parseCSVLine(line, delimiter);
          
          if (values.length !== headers.length) {
            logger.warn('CSV row column mismatch', { 
              line: i + 1, 
              expected: headers.length, 
              got: values.length 
            });
          }

          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          data.push(row);
        }

        logger.info('Data imported from CSV', { 
          filename: file.name, 
          rows: data.length 
        });
        resolve(data);
      } catch (error) {
        logger.error('Failed to parse CSV', error);
        reject(new Error('Invalid CSV file'));
      }
    };

    reader.onerror = () => {
      logger.error('Failed to read file', { filename: file.name });
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Import configuration from file
 * @param {File} file - File object
 * @returns {Promise<Object>} Parsed configuration
 */
export const importConfiguration = (file) => {
  return new Promise((resolve, reject) => {
    const extension = file.name.split('.').pop().toLowerCase();

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target.result;
        let config;

        switch (extension) {
          case 'json':
            config = JSON.parse(content);
            break;
          
          case 'yaml':
          case 'yml':
            // Simple YAML parsing (for complex YAML, use a library)
            config = yamlToObject(content);
            break;
          
          default:
            reject(new Error(`Unsupported file format: ${extension}`));
            return;
        }

        logger.info('Configuration imported', { 
          filename: file.name, 
          format: extension 
        });
        resolve(config);
      } catch (error) {
        logger.error('Failed to parse configuration', error);
        reject(new Error(`Invalid ${extension.toUpperCase()} file`));
      }
    };

    reader.onerror = () => {
      logger.error('Failed to read file', { filename: file.name });
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

/**
 * Download blob as file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename
 */
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Escape CSV value
 * @param {any} value - Value to escape
 * @returns {string} Escaped value
 */
const escapeCSV = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  const str = String(value);

  // If contains comma, quote, or newline, wrap in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
};

/**
 * Parse CSV line
 * @param {string} line - CSV line
 * @param {string} delimiter - Delimiter
 * @returns {Array} Values
 */
const parseCSVLine = (line, delimiter = ',') => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      // End of value
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last value
  values.push(current);

  return values;
};

/**
 * Get nested value from object
 * @param {Object} obj - Object
 * @param {string} path - Path (e.g., "a.b.c")
 * @returns {any} Value
 */
const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Simple object to YAML converter
 * @param {Object} obj - Object to convert
 * @param {number} indent - Indentation level
 * @returns {string} YAML string
 */
const objectToYAML = (obj, indent = 0) => {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  if (Array.isArray(obj)) {
    obj.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        yaml += `${spaces}-\n${objectToYAML(item, indent + 1)}`;
      } else {
        yaml += `${spaces}- ${item}\n`;
      }
    });
  } else if (typeof obj === 'object' && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        yaml += `${spaces}${key}:\n${objectToYAML(value, indent + 1)}`;
      } else {
        yaml += `${spaces}${key}: ${value}\n`;
      }
    });
  } else {
    yaml += `${spaces}${obj}\n`;
  }

  return yaml;
};

/**
 * Simple YAML to object parser (very basic, for complex YAML use a library)
 * @param {string} yaml - YAML string
 * @returns {Object} Parsed object
 */
const yamlToObject = (yaml) => {
  // This is a very basic implementation
  // For production, use a proper YAML library like js-yaml
  const lines = yaml.split('\n');
  const obj = {};
  let currentKey = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }

    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      currentKey = key.trim();
      
      if (value) {
        // Try to parse as JSON value
        try {
          obj[currentKey] = JSON.parse(value);
        } catch {
          obj[currentKey] = value;
        }
      }
    }
  });

  return obj;
};

/**
 * Validate import file
 * @param {File} file - File to validate
 * @param {Object} options - Validation options
 * @returns {Object} Validation result
 */
export const validateImportFile = (file, options = {}) => {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedExtensions = ['json', 'csv', 'xlsx', 'yaml', 'yml'],
  } = options;

  const errors = [];

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size exceeds ${maxSize / 1024 / 1024}MB limit`);
  }

  // Check extension
  const extension = file.name.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(extension)) {
    errors.push(`File type .${extension} is not supported. Allowed: ${allowedExtensions.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Batch export multiple items
 * @param {Array} items - Items to export
 * @param {Function} exportFn - Export function for single item
 * @param {string} format - Export format
 * @returns {Promise<void>}
 */
export const batchExport = async (items, exportFn, format = 'json') => {
  logger.info('Starting batch export', { count: items.length, format });

  for (const item of items) {
    try {
      await exportFn(item, format);
    } catch (error) {
      logger.error('Batch export item failed', { item: item.id, error });
      throw error;
    }
  }

  logger.info('Batch export complete', { count: items.length });
};

export default {
  exportToJSON,
  exportToCSV,
  exportToExcel,
  exportConfiguration,
  importFromJSON,
  importFromCSV,
  importConfiguration,
  validateImportFile,
  batchExport,
};

