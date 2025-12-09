import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { CheckCircleIcon, XCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

/**
 * Enhanced Form Input with Validation Feedback
 * 
 * Provides visual feedback for form validation states with accessible error messages.
 */

export const FormInput = ({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  success,
  hint,
  required = false,
  disabled = false,
  placeholder,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isTouched, setIsTouched] = useState(false);

  const showError = error && (isTouched || !isFocused);
  const showSuccess = success && value && !error;

  const inputClasses = `
    w-full px-3 py-2 border rounded-md shadow-sm
    focus:outline-none focus:ring-2 focus:ring-offset-0
    transition-colors duration-200
    disabled:bg-gray-100 disabled:cursor-not-allowed dark:disabled:bg-gray-800
    ${showError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}
    ${showSuccess ? 'border-green-500 focus:ring-green-500 focus:border-green-500' : ''}
    ${!showError && !showSuccess ? 'border-gray-300 dark:border-gray-600 focus:ring-primary-500 focus:border-primary-500' : ''}
    ${className}
  `;

  const handleBlur = (e) => {
    setIsTouched(true);
    setIsFocused(false);
    onBlur?.(e);
  };

  return (
    <div className="space-y-1">
      {label && (
        <label 
          htmlFor={name}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={handleBlur}
          onFocus={() => setIsFocused(true)}
          disabled={disabled}
          placeholder={placeholder}
          required={required}
          aria-invalid={showError}
          aria-describedby={
            showError ? `${name}-error` : 
            hint ? `${name}-hint` : undefined
          }
          className={inputClasses}
          {...props}
        />

        {/* Status icon */}
        {(showError || showSuccess) && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            {showError && (
              <XCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
            )}
            {showSuccess && (
              <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* Error message */}
      {showError && (
        <p 
          id={`${name}-error`}
          className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1 animate-in slide-in-from-top-1"
        >
          <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
          {error}
        </p>
      )}

      {/* Success message */}
      {showSuccess && typeof success === 'string' && (
        <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
          <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
          {success}
        </p>
      )}

      {/* Hint text */}
      {hint && !showError && (
        <p 
          id={`${name}-hint`}
          className="text-sm text-gray-500 dark:text-gray-400"
        >
          {hint}
        </p>
      )}
    </div>
  );
};

FormInput.propTypes = {
  label: PropTypes.string,
  name: PropTypes.string.isRequired,
  type: PropTypes.string,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  error: PropTypes.string,
  success: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  hint: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};

/**
 * Progress Indicator Component
 */
export const ProgressBar = ({ 
  value, 
  max = 100, 
  label,
  showPercentage = true,
  size = 'md',
  color = 'primary',
  animate = true,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizes = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-4',
  };

  const colors = {
    primary: 'bg-primary-600',
    success: 'bg-green-600',
    warning: 'bg-yellow-600',
    danger: 'bg-red-600',
    info: 'bg-blue-600',
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}

      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${sizes[size]}`}>
        <div
          className={`${colors[color]} ${sizes[size]} rounded-full transition-all duration-300 ease-out ${animate ? 'animate-pulse' : ''}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin="0"
          aria-valuemax={max}
        />
      </div>
    </div>
  );
};

ProgressBar.propTypes = {
  value: PropTypes.number.isRequired,
  max: PropTypes.number,
  label: PropTypes.string,
  showPercentage: PropTypes.bool,
  size: PropTypes.oneOf(['sm', 'md', 'lg']),
  color: PropTypes.oneOf(['primary', 'success', 'warning', 'danger', 'info']),
  animate: PropTypes.bool,
};

/**
 * Circular Progress Indicator
 */
export const CircularProgress = ({ 
  value, 
  max = 100,
  size = 64,
  strokeWidth = 4,
  label,
  showPercentage = true,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="inline-flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="text-primary-600 transition-all duration-300 ease-out"
          />
        </svg>

        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
      </div>

      {label && (
        <span className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {label}
        </span>
      )}
    </div>
  );
};

CircularProgress.propTypes = {
  value: PropTypes.number.isRequired,
  max: PropTypes.number,
  size: PropTypes.number,
  strokeWidth: PropTypes.number,
  label: PropTypes.string,
  showPercentage: PropTypes.bool,
};

/**
 * Spinner Component
 */
export const Spinner = ({ size = 'md', color = 'primary', label }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  const colors = {
    primary: 'border-primary-600',
    white: 'border-white',
    gray: 'border-gray-600',
  };

  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div
        className={`${sizes[size]} border-4 border-gray-200 dark:border-gray-700 ${colors[color]} border-t-transparent rounded-full animate-spin`}
        role="status"
        aria-label={label || "Loading"}
      >
        <span className="sr-only">{label || "Loading..."}</span>
      </div>
      {label && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {label}
        </span>
      )}
    </div>
  );
};

Spinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  color: PropTypes.oneOf(['primary', 'white', 'gray']),
  label: PropTypes.string,
};

export default {
  FormInput,
  ProgressBar,
  CircularProgress,
  Spinner,
};


