import React, { useState, useEffect } from 'react';

const RuleAwareInput = ({
  value,
  configurationId,
  propertyPath,
  onSave,
  onCancel,
  onValidation,
  autoFocus = true,
  className = ''
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  // Parse value for display
  const displayValue = typeof value === 'string' ? value : String(value);

  useEffect(() => {
    setInputValue(displayValue);
    fetchRules();
  }, [value, configurationId, propertyPath]);

  const fetchRules = async () => {
    if (!configurationId || !propertyPath) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/rules/configuration/${configurationId}/path/${encodeURIComponent(propertyPath)}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rulesArray = Array.isArray(data.rules) ? data.rules : [];
        setRules(rulesArray.filter(rule => rule.enabled));
      }
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateValue = async (val) => {
    if (!configurationId || !propertyPath) return true;

    setIsValidating(true);
    try {
      const response = await fetch('/api/rules/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          configurationId,
          propertyPath,
          value: val
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setValidationError(result.error || 'Validation failed');
        onValidation?.(false, result.error || 'Validation failed');
        return false;
      }

      if (!result.isValid) {
        const errorMsg = result.errors.join(', ');
        setValidationError(errorMsg);
        onValidation?.(false, errorMsg);
        return false;
      }

      setValidationError('');
      onValidation?.(true, '');
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      const errorMsg = 'Validation service unavailable';
      setValidationError(errorMsg);
      onValidation?.(false, errorMsg);
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const parseInputValue = (val) => {
    if (val === "true" || val === "false") {
      return val === "true";
    } else if (val === "null") {
      return null;
    } else if (val === "" || val === undefined) {
      return "";
    } else if (!isNaN(val) && val !== "" && val !== null) {
      return Number(val);
    }
    return val;
  };

  const handleInputChange = async (newValue) => {
    setInputValue(newValue);
    
    // Debounced validation
    setTimeout(async () => {
      const parsedValue = parseInputValue(newValue);
      await validateValue(parsedValue);
    }, 300);
  };

  const handleSave = async () => {
    const parsedValue = parseInputValue(inputValue);
    const isValid = await validateValue(parsedValue);
    
    if (isValid) {
      onSave(parsedValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 animate-spin border-2 border-gray-300 border-t-blue-500 rounded-full"></div>
        <span className="text-xs text-gray-500">Loading rules...</span>
      </div>
    );
  }

  // Find all applicable rules to determine input type
  const numericRules = rules.filter(rule => rule.ruleType === 'numeric');
  const collectionRule = rules.find(rule => rule.ruleType === 'collection');

  // For collection rules, render a select dropdown
  if (collectionRule && collectionRule.ruleConfig.validValues?.length > 0) {
    return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <select
            value={inputValue}
            onChange={(e) => {
              const newValue = e.target.value;
              setInputValue(newValue);
              handleInputChange(newValue);
            }}
            onKeyDown={handleKeyDown}
            autoFocus={autoFocus}
            className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 ${
              validationError
                ? 'border-red-300 focus:ring-red-500 dark:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-400'
            } ${className}`}
          >
            {collectionRule.ruleConfig.validValues.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {isValidating && (
            <div className="text-xs text-gray-500 dark:text-gray-400">Validating...</div>
          )}
          <button
            onClick={handleSave}
            className={`px-2 py-1 text-white text-xs rounded ${
              validationError
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
            disabled={!!validationError || isValidating}
          >
            ✓
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
          >
            ✕
          </button>
        </div>
        {validationError && (
          <div className="text-xs text-red-600 dark:text-red-400 ml-2">
            {validationError}
          </div>
        )}
      </div>
    );
  }

  // For numeric rules, render a number input with constraints
  if (numericRules.length > 0) {
    let min, max, step = 1;
    let constraints = [];
    let allIntegerValues = true;

    // Process all numeric rules to determine combined constraints
    numericRules.forEach(rule => {
      const config = rule.ruleConfig;

      // Track if all values are integers for step calculation
      if (!Number.isInteger(config.value)) {
        allIntegerValues = false;
      }

      // Determine constraints based on the operator
      switch (config.operator) {
        case 'greater':
          const greaterMin = config.value + (Number.isInteger(config.value) ? 1 : 0.001);
          min = min === undefined ? greaterMin : Math.max(min, greaterMin);
          constraints.push(`> ${config.value}`);
          break;
        case 'greaterEquals':
          min = min === undefined ? config.value : Math.max(min, config.value);
          constraints.push(`≥ ${config.value}`);
          break;
        case 'smaller':
          const smallerMax = config.value - (Number.isInteger(config.value) ? 1 : 0.001);
          max = max === undefined ? smallerMax : Math.min(max, smallerMax);
          constraints.push(`< ${config.value}`);
          break;
        case 'smallerEquals':
          max = max === undefined ? config.value : Math.min(max, config.value);
          constraints.push(`≤ ${config.value}`);
          break;
        case 'equals':
          min = max = config.value;
          constraints.push(`= ${config.value}`);
          break;
      }
    });

    // Set step based on whether all constraint values are integers
    step = allIntegerValues ? 1 : 0.001;

    return (
      <div className="flex flex-col space-y-1">
        <div className="flex items-center space-x-2">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => {
              const newValue = e.target.value;
              setInputValue(newValue);
              handleInputChange(newValue);
            }}
            onKeyDown={handleKeyDown}
            {...(min !== undefined && { min })}
            {...(max !== undefined && { max })}
            step={step}
            autoFocus={autoFocus}
            className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 ${
              validationError
                ? 'border-red-300 focus:ring-red-500 dark:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-400'
            } ${className}`}
            title={`Must be ${config.operator === 'greater' ? '>' : config.operator === 'greaterEquals' ? '≥' : config.operator === 'smaller' ? '<' : config.operator === 'smallerEquals' ? '≤' : '='} ${config.value}`}
          />
          {isValidating && (
            <div className="text-xs text-gray-500 dark:text-gray-400">Validating...</div>
          )}
          <button
            onClick={handleSave}
            className={`px-2 py-1 text-white text-xs rounded ${
              validationError
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
            disabled={!!validationError || isValidating}
          >
            ✓
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
          >
            ✕
          </button>
        </div>
        {validationError && (
          <div className="text-xs text-red-600 dark:text-red-400 ml-2">
            {validationError}
          </div>
        )}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Rule: {config.operator === 'greater' ? '>' : config.operator === 'greaterEquals' ? '≥' : config.operator === 'smaller' ? '<' : config.operator === 'smallerEquals' ? '≤' : '='} {config.value}
        </div>
      </div>
    );
  }

  // Default text input for properties without specific rules
  return (
    <div className="flex flex-col space-y-1">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            const newValue = e.target.value;
            setInputValue(newValue);
            handleInputChange(newValue);
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600 ${
            validationError
              ? 'border-red-300 focus:ring-red-500 dark:border-red-500'
              : 'border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-400'
          } ${className}`}
        />
        {isValidating && (
          <div className="text-xs text-gray-500 dark:text-gray-400">Validating...</div>
        )}
        <button
          onClick={handleSave}
          className={`px-2 py-1 text-white text-xs rounded ${
            validationError
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
          disabled={!!validationError || isValidating}
        >
          ✓
        </button>
        <button
          onClick={onCancel}
          className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
        >
          ✕
        </button>
      </div>
      {validationError && (
        <div className="text-xs text-red-600 dark:text-red-400 ml-2">
          {validationError}
        </div>
      )}
    </div>
  );
};

export default RuleAwareInput;
