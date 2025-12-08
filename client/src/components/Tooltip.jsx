import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

/**
 * Tooltip Component
 * 
 * Displays helpful information on hover or focus.
 */

const Tooltip = ({
  content,
  children,
  position = 'top',
  delay = 200,
  maxWidth = '200px',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState(null);

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true);
    }, delay);
    setTimeoutId(id);
  };

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setIsVisible(false);
  };

  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowPositions = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-700',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-700',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-700',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-700',
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}

      {isVisible && content && (
        <div
          role="tooltip"
          className={`
            absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg
            pointer-events-none fade-in
            ${positions[position]}
          `}
          style={{ maxWidth }}
        >
          {content}
          <div className={`absolute w-0 h-0 border-4 border-transparent ${arrowPositions[position]}`} />
        </div>
      )}
    </div>
  );
};

Tooltip.propTypes = {
  content: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
  position: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
  delay: PropTypes.number,
  maxWidth: PropTypes.string,
};

/**
 * Help Text Component with Icon
 */
export const HelpText = ({ children, tooltip }) => {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
      {children}
      {tooltip && (
        <Tooltip content={tooltip} position="top">
          <InformationCircleIcon className="w-4 h-4 cursor-help" />
        </Tooltip>
      )}
    </span>
  );
};

HelpText.propTypes = {
  children: PropTypes.node.isRequired,
  tooltip: PropTypes.node,
};

export default Tooltip;

