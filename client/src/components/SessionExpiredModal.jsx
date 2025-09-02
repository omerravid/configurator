import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const SessionExpiredModal = ({ isOpen, onLogin }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <ExclamationTriangleIcon className="w-8 h-8 text-yellow-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Session Expired
          </h2>
        </div>
        
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Your session has expired due to recent data changes. Please login again to continue.
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onLogin}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
          >
            Login Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiredModal;
