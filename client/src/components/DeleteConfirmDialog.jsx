import React, { useState, useEffect } from "react";
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  TrashIcon 
} from "@heroicons/react/24/outline";
import { configAPI } from "../services/api";

const DeleteConfirmDialog = ({ config, isOpen, onConfirm, onCancel }) => {
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && config) {
      loadChildren();
    }
  }, [isOpen, config]);

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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Delete Configuration
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-gray-600 mb-4">
            Are you sure you want to delete <strong>"{config.name}"</strong>?
          </p>

          {loading && (
            <div className="text-sm text-gray-500 mb-4">
              Checking for child configurations...
            </div>
          )}

          {hasChildren && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-red-900 mb-2">
                Cannot Delete - Has Child Configurations
              </h4>
              <p className="text-sm text-red-700 mb-3">
                This configuration has {children.length} child configuration{children.length !== 1 ? 's' : ''} that must be deleted or moved first:
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                {children.map((child) => (
                  <li key={child.id} className="flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    <span>{child.name} ({child.type})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasChildren && !loading && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                This action cannot be undone. The configuration and all its data will be permanently deleted.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {!hasChildren && !loading && (
            <button
              onClick={() => onConfirm(config)}
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
