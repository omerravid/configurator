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

  // Refs for debouncing
  const validationTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

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
      // Check if this is an array item path (contains [index])
      const isArrayItemPath = propertyPath.includes('[') && propertyPath.includes(']');
      let allRules = [];

      // Fetch rules for the specific property path
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
        allRules.push(...rulesArray);
      }

      // If this is an array item, also fetch rules for the parent array
      if (isArrayItemPath) {
        // Extract the array path by removing the [index] part
        const arrayPath = propertyPath.replace(/\[\d+\]$/, '');
        console.log('Fetching array-level rules for:', arrayPath);

        try {
          const arrayResponse = await fetch(
            `/api/rules/configuration/${configurationId}/path/${encodeURIComponent(arrayPath)}`,
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            }
          );

          if (arrayResponse.ok) {
            const arrayData = await arrayResponse.json();
            const arrayRulesArray = Array.isArray(arrayData.rules) ? arrayData.rules : [];
            console.log('Found array-level rules:', arrayRulesArray);
            allRules.push(...arrayRulesArray);
          }
        } catch (arrayError) {
          console.error('Failed to fetch array-level rules:', arrayError);
          // Continue with just the item-specific rules
        }
      }

      setRules(allRules.filter(rule => rule.enabled));
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateValue = async (val) => {
    if (!configurationId || !propertyPath) return true;

    // Create abort controller for this validation request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsValidating(true);
    try {
      // Check if this is an array item path (contains [index])
      const isArrayItemPath = propertyPath.includes('[') && propertyPath.includes(']');
      let allErrors = [];

      // Validate against the specific property path
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
        }),
        signal: abortController.signal
      });

      const result = await response.json();

      if (!response.ok) {
        setValidationError(result.error || 'Validation failed');
        onValidation?.(false, result.error || 'Validation failed');
        return false;
      }

      if (!result.isValid) {
        allErrors.push(...result.errors);
      }

      // If this is an array item, also validate against array-level rules
      if (isArrayItemPath) {
        // Extract the array path by removing the [index] part
        const arrayPath = propertyPath.replace(/\[\d+\]$/, '');
        console.log('Validating against array-level rules for:', arrayPath);

        try {
          const arrayResponse = await fetch('/api/rules/validate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              configurationId,
              propertyPath: arrayPath,
              value: val
            }),
            signal: abortController.signal
          });

          const arrayResult = await arrayResponse.json();

          if (arrayResponse.ok && !arrayResult.isValid) {
            console.log('Array-level validation failed:', arrayResult.errors);
            allErrors.push(...arrayResult.errors);
          }
        } catch (arrayError) {
          console.error('Failed to validate against array-level rules:', arrayError);
          // Continue with just the item-specific validation
        }
      }

      if (allErrors.length > 0) {
        const errorMsg = allErrors.join(', ');
        setValidationError(errorMsg);
        onValidation?.(false, errorMsg);
        return false;
      }

      setValidationError('');
      onValidation?.(true, '');
      return true;
    } catch (error) {
      // Don't show errors if request was aborted (user is still typing)
      if (error.name === 'AbortError') {
        console.log('Validation request aborted - user is still typing');
        return false;
      }

      console.error('Validation error:', error);
      const errorMsg = 'Validation service unavailable';
      setValidationError(errorMsg);
      onValidation?.(false, errorMsg);
      return false;
    } finally {
      // Only clear validation state if this request wasn't aborted
      if (abortControllerRef.current === abortController) {
        setIsValidating(false);
        abortControllerRef.current = null;
      }
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

    // Cancel previous validation timeout
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
      validationTimeoutRef.current = null;
    }

    // Cancel previous validation request if still in progress
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Clear validation state while typing
    setValidationError('');
    setIsValidating(false);

    // Debounced validation - only run after user stops typing for 500ms
    validationTimeoutRef.current = setTimeout(async () => {
      const parsedValue = parseInputValue(newValue);
      await validateValue(parsedValue);
      validationTimeoutRef.current = null;
    }, 500);
  };

  const handleSave = async () => {
    // Cancel any pending validation
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
      validationTimeoutRef.current = null;
    }

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
      // Cancel any pending validation
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
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

    console.log('Processing numeric rules for array item:', propertyPath, 'rules:', numericRules);

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
            title={`Must be ${constraints.join(' and ')}`}
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
          Rules: {constraints.join(', ')}
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
