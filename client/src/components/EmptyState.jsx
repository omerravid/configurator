import React from 'react';
import PropTypes from 'prop-types';
import { 
  InboxIcon, 
  MagnifyingGlassIcon,
  FolderIcon,
  DocumentIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  CloudIcon,
} from '@heroicons/react/24/outline';

/**
 * Empty State Component
 * 
 * Displays helpful messages and actions when there is no content to show.
 * Improves user experience by providing context and next steps.
 */

const EmptyState = ({ 
  icon: Icon = InboxIcon,
  title,
  description,
  action,
  actionLabel,
  secondaryAction,
  secondaryActionLabel,
  illustration,
  size = 'md',
  className = '',
}) => {
  const sizes = {
    sm: {
      container: 'p-6',
      icon: 'w-12 h-12',
      title: 'text-lg',
      description: 'text-sm',
    },
    md: {
      container: 'p-12',
      icon: 'w-16 h-16',
      title: 'text-xl',
      description: 'text-base',
    },
    lg: {
      container: 'p-16',
      icon: 'w-24 h-24',
      title: 'text-2xl',
      description: 'text-lg',
    },
  };

  const sizeClasses = sizes[size];

  return (
    <div className={`flex items-center justify-center ${sizeClasses.container} ${className}`}>
      <div className="max-w-md text-center">
        {illustration || (
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4">
              <Icon className={`${sizeClasses.icon} text-gray-400 dark:text-gray-500`} />
            </div>
          </div>
        )}

        <h3 className={`${sizeClasses.title} font-semibold text-gray-900 dark:text-gray-100 mb-2`}>
          {title}
        </h3>

        {description && (
          <p className={`${sizeClasses.description} text-gray-600 dark:text-gray-400 mb-6`}>
            {description}
          </p>
        )}

        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {action && (
              <button
                onClick={action}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                {actionLabel}
              </button>
            )}
            {secondaryAction && (
              <button
                onClick={secondaryAction}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
              >
                {secondaryActionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

EmptyState.propTypes = {
  icon: PropTypes.elementType,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  action: PropTypes.func,
  actionLabel: PropTypes.string,
  secondaryAction: PropTypes.func,
  secondaryActionLabel: PropTypes.string,
  illustration: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  className: PropTypes.string,
};

/**
 * Preset Empty States
 */

export const EmptyStateNoConfigurations = ({ onCreate }) => (
  <EmptyState
    icon={FolderIcon}
    title="No configurations yet"
    description="Get started by creating your first configuration. You can create products, components, or user configurations."
    action={onCreate}
    actionLabel="Create Configuration"
    size="lg"
  />
);

EmptyStateNoConfigurations.propTypes = {
  onCreate: PropTypes.func,
};

export const EmptyStateNoSearchResults = ({ onClear, searchQuery }) => (
  <EmptyState
    icon={MagnifyingGlassIcon}
    title="No results found"
    description={searchQuery ? `No configurations match "${searchQuery}". Try a different search term.` : 'Try adjusting your search or filters.'}
    action={onClear}
    actionLabel="Clear Search"
    size="md"
  />
);

EmptyStateNoSearchResults.propTypes = {
  onClear: PropTypes.func,
  searchQuery: PropTypes.string,
};

export const EmptyStateNoChildren = ({ parentName, onCreate }) => (
  <EmptyState
    icon={DocumentIcon}
    title={`No child configurations`}
    description={`"${parentName}" doesn't have any child configurations yet. Create one to get started.`}
    action={onCreate}
    actionLabel="Create Child"
    size="sm"
  />
);

EmptyStateNoChildren.propTypes = {
  parentName: PropTypes.string.isRequired,
  onCreate: PropTypes.func,
};

export const EmptyStateError = ({ error, onRetry }) => (
  <EmptyState
    icon={ExclamationTriangleIcon}
    title="Something went wrong"
    description={error || "We couldn't load the data. Please try again."}
    action={onRetry}
    actionLabel="Try Again"
    secondaryAction={() => window.location.reload()}
    secondaryActionLabel="Reload Page"
    size="md"
  />
);

EmptyStateError.propTypes = {
  error: PropTypes.string,
  onRetry: PropTypes.func,
};

export const EmptyStateOffline = ({ onRetry }) => (
  <EmptyState
    icon={CloudIcon}
    title="You're offline"
    description="Check your internet connection and try again."
    action={onRetry}
    actionLabel="Retry"
    size="md"
  />
);

EmptyStateOffline.propTypes = {
  onRetry: PropTypes.func,
};

export const EmptyStateNoData = ({ title, description, icon }) => (
  <EmptyState
    icon={icon || InboxIcon}
    title={title || "No data available"}
    description={description || "There's nothing to display right now."}
    size="md"
  />
);

EmptyStateNoData.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  icon: PropTypes.elementType,
};

export default EmptyState;


