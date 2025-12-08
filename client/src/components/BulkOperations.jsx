import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  TrashIcon, 
  ArchiveBoxIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';
import ConfirmDialog from './ConfirmDialog';
import { Spinner } from './FormComponents';

/**
 * Bulk Operations Component
 * 
 * Provides batch actions on multiple selected items:
 * - Select all / Deselect all
 * - Bulk delete
 * - Bulk archive/restore
 * - Bulk update
 * - Progress tracking
 * - Error handling
 */

const BulkOperations = ({
  items = [],
  selectedItems = [],
  onSelectionChange,
  operations = [],
  onOperationComplete,
  selectAllLabel = 'Select all',
  deselectAllLabel = 'Deselect all',
  renderItem,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errors, setErrors] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingOperation, setPendingOperation] = useState(null);

  const selectedCount = selectedItems.length;
  const allSelected = items.length > 0 && selectedCount === items.length;
  const someSelected = selectedCount > 0 && selectedCount < items.length;

  // Select/Deselect handlers
  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(items.map(item => item.id));
    }
  }, [items, allSelected, onSelectionChange]);

  const handleToggleItem = useCallback((itemId) => {
    if (selectedItems.includes(itemId)) {
      onSelectionChange(selectedItems.filter(id => id !== itemId));
    } else {
      onSelectionChange([...selectedItems, itemId]);
    }
  }, [selectedItems, onSelectionChange]);

  // Execute bulk operation
  const executeBulkOperation = async (operation) => {
    setIsProcessing(true);
    setErrors([]);
    
    const selectedData = items.filter(item => selectedItems.includes(item.id));
    const total = selectedData.length;
    setProgress({ current: 0, total });

    const operationErrors = [];
    let successCount = 0;

    logger.info('Starting bulk operation', {
      operation: operation.id,
      itemCount: total,
    });

    for (let i = 0; i < selectedData.length; i++) {
      const item = selectedData[i];
      
      try {
        await operation.handler(item);
        successCount++;
      } catch (error) {
        logger.error('Bulk operation item failed', {
          operation: operation.id,
          itemId: item.id,
          error,
        });
        operationErrors.push({
          itemId: item.id,
          itemName: item.name || item.id,
          error: error.message || 'Operation failed',
        });
      }

      setProgress({ current: i + 1, total });
    }

    setIsProcessing(false);
    setErrors(operationErrors);

    logger.info('Bulk operation complete', {
      operation: operation.id,
      successCount,
      errorCount: operationErrors.length,
    });

    // Clear selection on success
    if (operationErrors.length === 0) {
      onSelectionChange([]);
    }

    // Notify parent
    if (onOperationComplete) {
      onOperationComplete({
        operation: operation.id,
        successCount,
        errorCount: operationErrors.length,
        errors: operationErrors,
      });
    }

    setShowConfirm(false);
    setPendingOperation(null);
  };

  const handleOperationClick = (operation) => {
    if (operation.confirm !== false) {
      setPendingOperation(operation);
      setShowConfirm(true);
    } else {
      executeBulkOperation(operation);
    }
  };

  const handleConfirmOperation = () => {
    if (pendingOperation) {
      executeBulkOperation(pendingOperation);
    }
  };

  return (
    <div className="space-y-4">
      {/* Selection Header */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          {/* Select All Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(el) => el && (el.indeterminate = someSelected)}
              onChange={handleSelectAll}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {allSelected ? deselectAllLabel : selectAllLabel}
            </span>
          </label>

          {/* Selection Count */}
          {selectedCount > 0 && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {selectedCount} selected
            </span>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedCount > 0 && !isProcessing && (
          <div className="flex items-center gap-2">
            {operations.map(operation => {
              const Icon = operation.icon || CheckCircleIcon;
              return (
                <button
                  key={operation.id}
                  onClick={() => handleOperationClick(operation)}
                  disabled={operation.disabled}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                    ${operation.variant === 'danger'
                      ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
                      : operation.variant === 'warning'
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700 disabled:bg-yellow-300'
                      : 'bg-primary-600 text-white hover:bg-primary-700 disabled:bg-primary-300'
                    }
                    disabled:cursor-not-allowed disabled:opacity-50
                  `}
                  title={operation.description}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{operation.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Progress Indicator */}
        {isProcessing && (
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Processing {progress.current} of {progress.total}...
            </span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
                {errors.length} {errors.length === 1 ? 'error' : 'errors'} occurred
              </h4>
              <ul className="space-y-1 text-sm text-red-700 dark:text-red-400">
                {errors.map((error, index) => (
                  <li key={index}>
                    <strong>{error.itemName}:</strong> {error.error}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Items List */}
      <div className="space-y-2">
        {items.map(item => (
          <div
            key={item.id}
            className={`
              flex items-center gap-3 p-3 rounded-lg border transition-colors
              ${selectedItems.includes(item.id)
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
              }
            `}
          >
            <input
              type="checkbox"
              checked={selectedItems.includes(item.id)}
              onChange={() => handleToggleItem(item.id)}
              disabled={isProcessing}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {renderItem ? (
              renderItem(item, selectedItems.includes(item.id))
            ) : (
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {item.name || item.id}
                </div>
                {item.description && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {item.description}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && pendingOperation && (
        <ConfirmDialog
          isOpen={showConfirm}
          title={pendingOperation.confirmTitle || `Confirm ${pendingOperation.label}`}
          message={
            pendingOperation.confirmMessage ||
            `Are you sure you want to ${pendingOperation.label.toLowerCase()} ${selectedCount} ${selectedCount === 1 ? 'item' : 'items'}?`
          }
          variant={pendingOperation.variant || 'info'}
          onConfirm={handleConfirmOperation}
          onCancel={() => {
            setShowConfirm(false);
            setPendingOperation(null);
          }}
        />
      )}
    </div>
  );
};

BulkOperations.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string,
    description: PropTypes.string,
  })).isRequired,
  selectedItems: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])).isRequired,
  onSelectionChange: PropTypes.func.isRequired,
  operations: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string,
    icon: PropTypes.elementType,
    variant: PropTypes.oneOf(['primary', 'danger', 'warning']),
    handler: PropTypes.func.isRequired,
    confirm: PropTypes.bool,
    confirmTitle: PropTypes.string,
    confirmMessage: PropTypes.string,
    disabled: PropTypes.bool,
  })).isRequired,
  onOperationComplete: PropTypes.func,
  selectAllLabel: PropTypes.string,
  deselectAllLabel: PropTypes.string,
  renderItem: PropTypes.func,
};

// Pre-built bulk operation handlers
export const bulkOperationHandlers = {
  /**
   * Create delete handler
   */
  delete: (apiDeleteFn) => async (item) => {
    await apiDeleteFn(item.id);
  },

  /**
   * Create archive handler
   */
  archive: (apiArchiveFn) => async (item) => {
    await apiArchiveFn(item.id);
  },

  /**
   * Create restore handler
   */
  restore: (apiRestoreFn) => async (item) => {
    await apiRestoreFn(item.id);
  },

  /**
   * Create duplicate handler
   */
  duplicate: (apiDuplicateFn) => async (item) => {
    await apiDuplicateFn(item.id);
  },

  /**
   * Create update handler
   */
  update: (apiUpdateFn, updateData) => async (item) => {
    await apiUpdateFn(item.id, updateData);
  },
};

// Common bulk operations
export const commonBulkOperations = {
  delete: {
    id: 'delete',
    label: 'Delete',
    description: 'Delete selected items',
    icon: TrashIcon,
    variant: 'danger',
    confirm: true,
    confirmTitle: 'Delete Items',
    confirmMessage: 'This action cannot be undone.',
  },
  archive: {
    id: 'archive',
    label: 'Archive',
    description: 'Archive selected items',
    icon: ArchiveBoxIcon,
    variant: 'warning',
    confirm: true,
  },
  restore: {
    id: 'restore',
    label: 'Restore',
    description: 'Restore selected items',
    icon: ArrowPathIcon,
    variant: 'primary',
    confirm: false,
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    description: 'Duplicate selected items',
    icon: DocumentDuplicateIcon,
    variant: 'primary',
    confirm: false,
  },
};

export default BulkOperations;

