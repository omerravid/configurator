import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  InformationCircleIcon, 
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { logger } from '../utils/logger';

/**
 * Notification System
 * 
 * Provides toast notifications with:
 * - Multiple types (success, error, warning, info)
 * - Auto-dismiss
 * - Action buttons
 * - Position control
 * - Queue management
 * - Progress indicators
 */

const NotificationContext = createContext(null);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children, position = 'top-right', maxNotifications = 5 }) => {
  const [notifications, setNotifications] = useState([]);
  const notificationIdRef = useRef(0);

  const addNotification = useCallback((notification) => {
    const id = notificationIdRef.current++;
    
    const newNotification = {
      id,
      type: 'info',
      duration: 5000,
      dismissible: true,
      ...notification,
      createdAt: Date.now(),
    };

    setNotifications(prev => {
      // Limit max notifications
      const updated = [newNotification, ...prev].slice(0, maxNotifications);
      return updated;
    });

    logger.debug('Notification added', { 
      id, 
      type: newNotification.type,
      title: newNotification.title 
    });

    // Auto-dismiss
    if (newNotification.duration > 0) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, [maxNotifications]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    logger.debug('Notification removed', { id });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    logger.debug('All notifications cleared');
  }, []);

  // Shorthand methods
  const success = useCallback((title, options = {}) => {
    return addNotification({ type: 'success', title, ...options });
  }, [addNotification]);

  const error = useCallback((title, options = {}) => {
    return addNotification({ type: 'error', title, duration: 0, ...options });
  }, [addNotification]);

  const warning = useCallback((title, options = {}) => {
    return addNotification({ type: 'warning', title, ...options });
  }, [addNotification]);

  const info = useCallback((title, options = {}) => {
    return addNotification({ type: 'info', title, ...options });
  }, [addNotification]);

  const value = {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    success,
    error,
    warning,
    info,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer 
        notifications={notifications} 
        onRemove={removeNotification}
        position={position}
      />
    </NotificationContext.Provider>
  );
};

NotificationProvider.propTypes = {
  children: PropTypes.node.isRequired,
  position: PropTypes.oneOf([
    'top-left',
    'top-center',
    'top-right',
    'bottom-left',
    'bottom-center',
    'bottom-right',
  ]),
  maxNotifications: PropTypes.number,
};

/**
 * Notification Container
 */
const NotificationContainer = ({ notifications, onRemove, position }) => {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <div 
      className={`fixed z-50 ${positionClasses[position]} max-w-sm w-full space-y-2 pointer-events-none`}
      aria-live="polite"
      aria-atomic="true"
    >
      {notifications.map(notification => (
        <Notification
          key={notification.id}
          notification={notification}
          onRemove={() => onRemove(notification.id)}
        />
      ))}
    </div>
  );
};

NotificationContainer.propTypes = {
  notifications: PropTypes.array.isRequired,
  onRemove: PropTypes.func.isRequired,
  position: PropTypes.string.isRequired,
};

/**
 * Individual Notification Component
 */
const Notification = ({ notification, onRemove }) => {
  const [progress, setProgress] = useState(100);
  const [isHovered, setIsHovered] = useState(false);

  const { type, title, message, action, dismissible, duration } = notification;

  // Progress bar animation
  useEffect(() => {
    if (duration <= 0 || isHovered) {
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [duration, isHovered]);

  const typeConfig = {
    success: {
      icon: CheckCircleIcon,
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      iconColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-200 dark:border-green-800',
      progressColor: 'bg-green-500',
    },
    error: {
      icon: XCircleIcon,
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      iconColor: 'text-red-600 dark:text-red-400',
      borderColor: 'border-red-200 dark:border-red-800',
      progressColor: 'bg-red-500',
    },
    warning: {
      icon: ExclamationTriangleIcon,
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      iconColor: 'text-yellow-600 dark:text-yellow-400',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      progressColor: 'bg-yellow-500',
    },
    info: {
      icon: InformationCircleIcon,
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      iconColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-200 dark:border-blue-800',
      progressColor: 'bg-blue-500',
    },
  };

  const config = typeConfig[type] || typeConfig.info;
  const Icon = config.icon;

  return (
    <div
      className={`
        ${config.bgColor} ${config.borderColor}
        border rounded-lg shadow-lg overflow-hidden
        slide-in-right pointer-events-auto
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="alert"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Icon className={`h-6 w-6 ${config.iconColor} flex-shrink-0`} />
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </p>
            {message && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {message}
              </p>
            )}
            {action && (
              <button
                onClick={() => {
                  action.onClick();
                  onRemove();
                }}
                className={`mt-2 text-sm font-medium ${config.iconColor} hover:underline`}
              >
                {action.label}
              </button>
            )}
          </div>

          {dismissible && (
            <button
              onClick={onRemove}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Dismiss notification"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {duration > 0 && (
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <div
            className={`h-full ${config.progressColor} transition-all duration-50 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

Notification.propTypes = {
  notification: PropTypes.shape({
    id: PropTypes.number.isRequired,
    type: PropTypes.oneOf(['success', 'error', 'warning', 'info']).isRequired,
    title: PropTypes.string.isRequired,
    message: PropTypes.string,
    action: PropTypes.shape({
      label: PropTypes.string.isRequired,
      onClick: PropTypes.func.isRequired,
    }),
    dismissible: PropTypes.bool,
    duration: PropTypes.number,
  }).isRequired,
  onRemove: PropTypes.func.isRequired,
};

/**
 * Standalone notification function (without context)
 * Useful for calling from non-React code
 */
export const showNotification = (notification) => {
  // Dispatch custom event
  const event = new CustomEvent('show-notification', { detail: notification });
  window.dispatchEvent(event);
};

// Listen for standalone notifications
if (typeof window !== 'undefined') {
  window.addEventListener('show-notification', (event) => {
    logger.debug('Standalone notification triggered', event.detail);
  });
}

export default NotificationProvider;

