import React, { useState, useEffect } from "react";
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  TrashIcon 
} from "@heroicons/react/24/outline";
import { configAPI } from "../services/api";
import { useEscapeKey } from "../utils/accessibility.jsx";

const DeleteConfirmDialog = ({ config, isOpen, onConfirm, onCancel }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && config) {
      loadChildren();
    }
  }, [isOpen, config]);

  // Handle ESC key to close dialog
  useEscapeKey(() => onCancel(), isOpen);

  const loadChildren = async () => {
    setLoading(true);
    try {
      const response = await configAPI.getChildren(config.id);
      setChildren(response.data.children || []);
    } catch (error) {
      console.error("Failed to load children:", error);
      setChildren([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !config) return null;

  const hasChildren = children.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Delete Configuration
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Are you sure you want to delete <strong>"{config.name}"</strong>?
          </p>

          {loading && (
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Checking for child configurations...
            </div>
          )}

          {hasChildren && !loading && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
                Cannot Delete - Has Child Configurations
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                This configuration has {children.length} child configuration{children.length !== 1 ? 's' : ''} that must be deleted or moved first:
              </p>
              <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                {children.map((child) => (
                  <li key={child.id} className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-red-400 dark:bg-red-500 rounded-full"></span>
                    <span>{child.name} ({child.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasChildren && !loading && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This action cannot be undone. The configuration and all its data will be permanently deleted.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {!hasChildren && !loading && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center space-x-2"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Delete Configuration</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmDialog;
