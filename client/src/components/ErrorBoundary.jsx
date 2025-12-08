import React from 'react';
import PropTypes from 'prop-types';
import { logger } from '../utils/logger';

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of crashing.
 * 
 * Usage:
 * <ErrorBoundary fallback={<CustomFallback />}>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console and any logging service
    logger.error('Error Boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.props.name || 'Unknown',
    });

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <svg
                className="w-6 h-6 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
              {this.props.title || 'Something went wrong'}
            </h2>

            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
              {this.props.message || 
                'An unexpected error occurred. Please try again or contact support if the problem persists.'}
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <summary className="cursor-pointer text-sm font-medium text-red-900 dark:text-red-300 mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2">
                  <p className="text-sm font-mono text-red-800 dark:text-red-400 mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-red-700 dark:text-red-500 overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.href = '/'}
                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-md transition-colors"
              >
                Go Home
              </button>
            </div>

            {this.props.showReloadButton && (
              <button
                onClick={() => window.location.reload()}
                className="w-full mt-3 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 underline"
              >
                Reload Page
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  /** Child components to wrap */
  children: PropTypes.node.isRequired,
  
  /** Custom fallback UI to display on error */
  fallback: PropTypes.node,
  
  /** Title for the error message */
  title: PropTypes.string,
  
  /** Message to display to the user */
  message: PropTypes.string,
  
  /** Name identifier for this error boundary (for logging) */
  name: PropTypes.string,
  
  /** Show reload page button */
  showReloadButton: PropTypes.bool,
  
  /** Callback when error occurs */
  onError: PropTypes.func,
  
  /** Callback when user clicks "Try Again" */
  onReset: PropTypes.func,
};

ErrorBoundary.defaultProps = {
  fallback: null,
  title: 'Something went wrong',
  message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  name: 'ErrorBoundary',
  showReloadButton: true,
  onError: null,
  onReset: null,
};

export default ErrorBoundary;

