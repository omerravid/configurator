import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  ArrowUpTrayIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { useEscapeKey } from '../utils/accessibility.jsx';
import { parseImportFile, prepareConfigurationsForImport } from '../utils/exportImport';
import { Spinner } from './FormComponents';

/**
 * Import Modal Component
 * 
 * Handles importing configurations from JSON files with validation and preview.
 */
const ImportModal = ({
  isOpen,
  onClose,
  onImport,
  existingConfigurations = [],
}) => {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [validation, setValidation] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [options, setOptions] = useState({
    renameOnConflict: true,
    setAsDraft: true,
  });

  // Handle Escape key
  useEscapeKey(() => {
    if (isOpen && !importing) {
      handleClose();
    }
  }, isOpen && !importing);

  const handleClose = () => {
    if (!importing) {
      setFile(null);
      setParsedData(null);
      setValidation(null);
      setImportResult(null);
      onClose();
    }
  };

  const handleFileSelect = async (selectedFile) => {
    setFile(selectedFile);
    setImportResult(null);

    try {
      const result = await parseImportFile(selectedFile);
      setParsedData(result.data);
      setValidation(result.validation);
    } catch (error) {
      setValidation({
        valid: false,
        errors: [error.message],
      });
    }
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  }, []);

  const handleImport = async () => {
    if (!parsedData || !validation.valid) return;

    setImporting(true);

    try {
      // Prepare configurations for import
      const prepared = prepareConfigurationsForImport(
        parsedData.configurations,
        existingConfigurations,
        options
      );

      // Call parent import handler
      const result = await onImport(prepared);
      
      setImportResult(result);
      
      // Close modal after successful import (after showing result briefly)
      if (result.successCount > 0) {
        setTimeout(() => {
          handleClose();
        }, 2000);
      }
    } catch (error) {
      setImportResult({
        successCount: 0,
        failureCount: parsedData.configurations.length,
        errors: [error.message],
      });
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 fade-in"
        onClick={importing ? undefined : handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative w-full max-w-2xl transform rounded-lg bg-white dark:bg-gray-800 shadow-xl transition-all scale-in">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <ArrowUpTrayIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Import Configurations
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Import configurations from JSON file
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={importing}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 disabled:opacity-50"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {/* File Upload Area */}
              {!file && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`
                    relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
                    ${dragActive
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                    }
                  `}
                >
                  <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                    Drop your JSON file here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Supports exported configuration files (max 10MB)
                  </p>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileInputChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              )}

              {/* File Info & Validation */}
              {file && (
                <div className="space-y-4">
                  {/* File Info */}
                  <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <DocumentTextIcon className="h-8 w-8 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setFile(null);
                        setParsedData(null);
                        setValidation(null);
                      }}
                      disabled={importing}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Validation Results */}
                  {validation && (
                    <div className={`
                      p-4 rounded-lg border
                      ${validation.valid
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }
                    `}>
                      <div className="flex items-start gap-3">
                        {validation.valid ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        ) : (
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <h4 className={`text-sm font-semibold ${
                            validation.valid
                              ? 'text-green-800 dark:text-green-300'
                              : 'text-red-800 dark:text-red-300'
                          }`}>
                            {validation.valid ? 'Valid Import File' : 'Validation Errors'}
                          </h4>
                          {validation.valid ? (
                            <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                              Found {validation.count} configuration{validation.count !== 1 ? 's' : ''} ready to import
                            </p>
                          ) : (
                            <ul className="mt-2 text-sm text-red-700 dark:text-red-400 list-disc list-inside space-y-1">
                              {validation.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Import Options */}
                  {validation?.valid && (
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Import Options
                      </h4>
                      
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={options.renameOnConflict}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            renameOnConflict: e.target.checked,
                          }))}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Rename on conflict
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Automatically rename configurations if names already exist
                          </p>
                        </div>
                      </label>

                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={options.setAsDraft}
                          onChange={(e) => setOptions(prev => ({
                            ...prev,
                            setAsDraft: e.target.checked,
                          }))}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Import as drafts
                          </span>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Set all imported configurations to DRAFT status
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  {/* Import Result */}
                  {importResult && (
                    <div className={`
                      p-4 rounded-lg border
                      ${importResult.successCount > 0
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                      }
                    `}>
                      <div className="flex items-start gap-3">
                        {importResult.successCount > 0 ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                        ) : (
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <h4 className={`text-sm font-semibold ${
                            importResult.successCount > 0
                              ? 'text-green-800 dark:text-green-300'
                              : 'text-red-800 dark:text-red-300'
                          }`}>
                            Import {importResult.successCount > 0 ? 'Completed' : 'Failed'}
                          </h4>
                          <p className="mt-1 text-sm text-gray-700 dark:text-gray-400">
                            Successfully imported: {importResult.successCount} / {importResult.total}
                          </p>
                          {importResult.failureCount > 0 && importResult.errors && (
                            <ul className="mt-2 text-sm text-red-700 dark:text-red-400 list-disc list-inside space-y-1">
                              {importResult.errors.slice(0, 5).map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                              {importResult.errors.length > 5 && (
                                <li>...and {importResult.errors.length - 5} more</li>
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button
                onClick={handleClose}
                disabled={importing}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!validation?.valid || importing || importResult}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <Spinner size="sm" />
                    Importing...
                  </>
                ) : (
                  <>
                    <ArrowUpTrayIcon className="h-4 w-4" />
                    Import Configurations
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

ImportModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onImport: PropTypes.func.isRequired,
  existingConfigurations: PropTypes.array,
};

export default ImportModal;



