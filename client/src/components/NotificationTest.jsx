import React from 'react';
import PropTypes from 'prop-types';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';

/**
 * Test component for notification systems
 * Can be temporarily added to Dashboard for manual testing
 */
const NotificationTest = ({ onClose }) => {
  const notifications = useNotifications();
  const { showToast } = useToast();

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          🧪 Notification Test Panel
        </h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
          New System (NotificationContext):
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => notifications.success('Success!', { message: 'Operation completed' })}
            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
          >
            Success
          </button>
          <button
            onClick={() => notifications.error('Error!', { message: 'Something went wrong' })}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Error
          </button>
          <button
            onClick={() => notifications.warning('Warning!', { message: 'Please review' })}
            className="px-2 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >
            Warning
          </button>
          <button
            onClick={() => notifications.info('Info', { message: 'Did you know?' })}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Info
          </button>
        </div>

        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-4 mb-2">
          Legacy System (ToastContext):
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => showToast('Toast success!', 'success')}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
          >
            Toast Success
          </button>
          <button
            onClick={() => showToast('Toast error!', 'error')}
            className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
          >
            Toast Error
          </button>
        </div>

        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-4 mb-2">
          Advanced:
        </div>
        <button
          onClick={() => notifications.info('With Action', {
            message: 'Click the action button',
            action: {
              label: 'Retry',
              onClick: () => alert('Action clicked!'),
            },
          })}
          className="w-full px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Notification with Action
        </button>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Both systems work independently. Remove this component after testing.
        </p>
      </div>
    </div>
  );
};

NotificationTest.propTypes = {
  onClose: PropTypes.func,
};

export default NotificationTest;

