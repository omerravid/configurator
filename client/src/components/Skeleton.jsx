import React from 'react';
import PropTypes from 'prop-types';

/**
 * Skeleton Component
 * 
 * Provides loading placeholders that mimic the layout of content being loaded.
 * Improves perceived performance by showing structure while data loads.
 */

/**
 * Base Skeleton component with shimmer animation
 */
export const Skeleton = ({ 
  width = '100%', 
  height = '1rem', 
  className = '', 
  variant = 'text',
  rounded = 'md',
  animate = true 
}) => {
  const baseClasses = 'bg-gray-200 dark:bg-gray-700';
  const animateClasses = animate ? 'animate-pulse' : '';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
  };

  const roundedClasses = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    full: 'rounded-full',
  };

  const classes = `${baseClasses} ${animateClasses} ${variantClasses[variant] || roundedClasses[rounded]} ${className}`;

  return (
    <div 
      className={classes}
      style={{ width, height }}
      role="status"
      aria-label="Loading..."
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

Skeleton.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  className: PropTypes.string,
  variant: PropTypes.oneOf(['text', 'circular', 'rectangular']),
  rounded: PropTypes.oneOf(['none', 'sm', 'md', 'lg', 'full']),
  animate: PropTypes.bool,
};

/**
 * Avatar Skeleton
 */
export const SkeletonAvatar = ({ size = 'md' }) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <Skeleton 
      variant="circular" 
      className={sizes[size]} 
      width={undefined}
      height={undefined}
    />
  );
};

SkeletonAvatar.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
};

/**
 * Card Skeleton
 */
export const SkeletonCard = ({ showImage = true, lines = 3 }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
      {showImage && (
        <Skeleton height="12rem" rounded="md" />
      )}
      <Skeleton height="1.5rem" width="60%" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          height="1rem" 
          width={i === lines - 1 ? '80%' : '100%'} 
        />
      ))}
    </div>
  );
};

SkeletonCard.propTypes = {
  showImage: PropTypes.bool,
  lines: PropTypes.number,
};

/**
 * List Item Skeleton
 */
export const SkeletonListItem = ({ showAvatar = true, lines = 2 }) => {
  return (
    <div className="flex items-start gap-3 p-3">
      {showAvatar && <SkeletonAvatar size="md" />}
      <div className="flex-1 space-y-2">
        <Skeleton height="1rem" width="40%" />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton 
            key={i} 
            height="0.875rem" 
            width={i === lines - 1 ? '70%' : '100%'} 
          />
        ))}
      </div>
    </div>
  );
};

SkeletonListItem.propTypes = {
  showAvatar: PropTypes.bool,
  lines: PropTypes.number,
};

/**
 * Table Row Skeleton
 */
export const SkeletonTableRow = ({ columns = 4 }) => {
  return (
    <tr className="border-b border-gray-200 dark:border-gray-700">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton height="1rem" width={i === 0 ? '60%' : '80%'} />
        </td>
      ))}
    </tr>
  );
};

SkeletonTableRow.propTypes = {
  columns: PropTypes.number,
};

/**
 * Form Skeleton
 */
export const SkeletonForm = ({ fields = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton height="1rem" width="30%" />
          <Skeleton height="2.5rem" rounded="md" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton height="2.5rem" width="6rem" rounded="md" />
        <Skeleton height="2.5rem" width="6rem" rounded="md" />
      </div>
    </div>
  );
};

SkeletonForm.propTypes = {
  fields: PropTypes.number,
};

/**
 * Tree Item Skeleton (for configuration tree)
 */
export const SkeletonTreeItem = ({ indent = 0, hasChildren = true }) => {
  return (
    <div 
      className="flex items-center gap-2 p-2"
      style={{ paddingLeft: `${indent * 1.5}rem` }}
    >
      {hasChildren && <Skeleton width="1rem" height="1rem" variant="rectangular" />}
      <Skeleton variant="circular" width="1.5rem" height="1.5rem" />
      <Skeleton height="1rem" width="60%" />
    </div>
  );
};

SkeletonTreeItem.propTypes = {
  indent: PropTypes.number,
  hasChildren: PropTypes.bool,
};

/**
 * Dashboard Skeleton
 */
export const SkeletonDashboard = () => {
  return (
    <div className="h-screen flex">
      {/* Sidebar skeleton */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 space-y-2">
        <Skeleton height="2.5rem" rounded="md" className="mb-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonTreeItem key={i} indent={i % 3} hasChildren={i % 2 === 0} />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <Skeleton height="2rem" width="30%" />
          <Skeleton height="2.5rem" width="8rem" rounded="md" />
        </div>
        <SkeletonCard showImage={false} lines={10} />
      </div>
    </div>
  );
};

/**
 * Shimmer effect using CSS (add to your CSS file)
 */
export const shimmerStyles = `
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.skeleton-shimmer {
  animation: shimmer 2s infinite linear;
  background: linear-gradient(
    to right,
    #f0f0f0 0%,
    #e0e0e0 20%,
    #f0f0f0 40%,
    #f0f0f0 100%
  );
  background-size: 1000px 100%;
}

.dark .skeleton-shimmer {
  background: linear-gradient(
    to right,
    #374151 0%,
    #4b5563 20%,
    #374151 40%,
    #374151 100%
  );
}
`;

export default Skeleton;


