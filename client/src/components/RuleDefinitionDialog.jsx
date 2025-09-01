import React, { useState, useEffect } from "react";
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";

const RuleDefinitionDialog = ({ 
  isOpen, 
  onClose, 
  configurationId, 
  propertyPath, 
  existingRules = [],
  onRulesUpdated 
}) => {
  const { showToast } = useToast();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRules(existingRules.map(rule => ({ ...rule, isExisting: true })));
    }
  }, [isOpen, existingRules]);

  const handleClose = () => {
    setRules([]);
    onClose();
  };

  const addRule = () => {
    const newRule = {
      id: `temp-${Date.now()}`,
      propertyPath,
      ruleType: 'numeric',
      ruleConfig: { operator: 'greater', value: 0 },
      errorMessage: '',
      enabled: true,
      isExisting: false,
      isNew: true
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (index) => {
    const updatedRules = rules.filter((_, i) => i !== index);
    setRules(updatedRules);
  };

  const updateRule = (index, field, value) => {
    const updatedRules = [...rules];
    updatedRules[index] = { ...updatedRules[index], [field]: value };
    
    // Reset ruleConfig when ruleType changes
    if (field === 'ruleType') {
      switch (value) {
        case 'numeric':
          updatedRules[index].ruleConfig = { operator: 'greater', value: 0 };
          break;
        case 'pattern':
          updatedRules[index].ruleConfig = { pattern: '', flags: '' };
          break;
        case 'collection':
          updatedRules[index].ruleConfig = { validValues: [''] };
          break;
      }
    }
    
    setRules(updatedRules);
  };

  const updateRuleConfig = (index, configField, value) => {
    const updatedRules = [...rules];
    updatedRules[index].ruleConfig = {
      ...updatedRules[index].ruleConfig,
      [configField]: value
    };
    setRules(updatedRules);
  };

  const addValidValue = (ruleIndex) => {
    const updatedRules = [...rules];
    updatedRules[ruleIndex].ruleConfig.validValues.push('');
    setRules(updatedRules);
  };

  const removeValidValue = (ruleIndex, valueIndex) => {
    const updatedRules = [...rules];
    updatedRules[ruleIndex].ruleConfig.validValues = 
      updatedRules[ruleIndex].ruleConfig.validValues.filter((_, i) => i !== valueIndex);
    setRules(updatedRules);
  };

  const updateValidValue = (ruleIndex, valueIndex, value) => {
    const updatedRules = [...rules];
    updatedRules[ruleIndex].ruleConfig.validValues[valueIndex] = value;
    setRules(updatedRules);
  };

  const saveRules = async () => {
    console.log("=== saveRules DEBUG ===");
    console.log("configurationId:", configurationId);
    console.log("propertyPath:", propertyPath);
    console.log("rules:", rules);
    console.log("localStorage token:", localStorage.getItem('token') ? 'Present' : 'Missing');

    setLoading(true);
    try {
      // Validate rules before saving
      console.log("Validating rules...");
      const invalidRules = rules.filter(rule => !validateRule(rule));
      if (invalidRules.length > 0) {
        console.log("Invalid rules found:", invalidRules);
        showToast("Please fix invalid rule configurations", "error");
        setLoading(false);
        return;
      }
      console.log("All rules valid");

      // Save new rules and update existing ones
      for (const [index, rule] of rules.entries()) {
        console.log(`Processing rule ${index}:`, rule);

        if (rule.isNew) {
          // Create new rule
          console.log("Creating new rule...");
          const payload = {
            configurationId,
            propertyPath: rule.propertyPath,
            ruleType: rule.ruleType,
            ruleConfig: rule.ruleConfig,
            errorMessage: rule.errorMessage,
            enabled: rule.enabled
          };
          console.log("Create rule payload:", payload);

          const response = await fetch('/api/rules', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
          });

          console.log("Create rule response status:", response.status);

          if (!response.ok) {
            const errorData = await response.text();
            console.error("Create rule failed:", errorData);
            throw new Error(`Failed to create rule: ${response.status} ${errorData}`);
          }

          const createdRule = await response.json();
          console.log("Rule created successfully:", createdRule);
        } else if (rule.isExisting && rule.id && !rule.id.startsWith('temp-')) {
          // Update existing rule
          const response = await fetch(`/api/rules/${rule.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              ruleType: rule.ruleType,
              ruleConfig: rule.ruleConfig,
              errorMessage: rule.errorMessage,
              enabled: rule.enabled
            })
          });

          if (!response.ok) {
            throw new Error('Failed to update rule');
          }
        }
      }

      // Delete rules that were removed
      const removedRules = existingRules.filter(
        existing => !rules.find(current => current.id === existing.id)
      );

      for (const rule of removedRules) {
        if (rule.id && !rule.id.startsWith('temp-')) {
          const response = await fetch(`/api/rules/${rule.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (!response.ok) {
            throw new Error('Failed to delete rule');
          }
        }
      }

      showToast("Rules saved successfully", "success");
      onRulesUpdated();
      handleClose();
    } catch (error) {
      console.error('Failed to save rules:', error);
      showToast("Failed to save rules", "error");
    } finally {
      setLoading(false);
    }
  };

  const validateRule = (rule) => {
    if (!rule.ruleType || !rule.ruleConfig) return false;

    switch (rule.ruleType) {
      case 'numeric':
        return rule.ruleConfig.operator && rule.ruleConfig.value !== undefined;
      case 'pattern':
        return rule.ruleConfig.pattern;
      case 'collection':
        return Array.isArray(rule.ruleConfig.validValues) && 
               rule.ruleConfig.validValues.length > 0 &&
               rule.ruleConfig.validValues.every(v => v !== '');
      default:
        return false;
    }
  };

  const renderRuleConfig = (rule, index) => {
    switch (rule.ruleType) {
      case 'numeric':
        return (
          <div className="grid grid-cols-2 gap-3">
            <select
              value={rule.ruleConfig.operator || 'greater'}
              onChange={(e) => updateRuleConfig(index, 'operator', e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="greater">Greater than</option>
              <option value="greaterEquals">Greater than or equal</option>
              <option value="smaller">Less than</option>
              <option value="smallerEquals">Less than or equal</option>
              <option value="equals">Equals</option>
            </select>
            <input
              type="number"
              value={rule.ruleConfig.value || 0}
              onChange={(e) => updateRuleConfig(index, 'value', parseFloat(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Value"
            />
          </div>
        );

      case 'pattern':
        return (
          <div className="space-y-3">
            <input
              type="text"
              value={rule.ruleConfig.pattern || ''}
              onChange={(e) => updateRuleConfig(index, 'pattern', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Regular expression pattern"
            />
            <input
              type="text"
              value={rule.ruleConfig.flags || ''}
              onChange={(e) => updateRuleConfig(index, 'flags', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Regex flags (optional, e.g., 'i' for case-insensitive)"
            />
          </div>
        );

      case 'collection':
        return (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Valid Values:
            </label>
            {rule.ruleConfig.validValues?.map((value, valueIndex) => (
              <div key={valueIndex} className="flex gap-2">
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateValidValue(index, valueIndex, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder="Valid value"
                />
                <button
                  onClick={() => removeValidValue(index, valueIndex)}
                  className="px-2 py-2 text-red-600 hover:text-red-700 transition-colors"
                  disabled={rule.ruleConfig.validValues.length === 1}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => addValidValue(index)}
              className="flex items-center gap-1 px-3 py-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Value
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Rules for {propertyPath}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {rules.length === 0 ? (
            <div className="text-center py-8">
              <ExclamationTriangleIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                No rules defined for this property
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {rules.map((rule, index) => (
                <div key={rule.id || index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <select
                      value={rule.ruleType}
                      onChange={(e) => updateRule(index, 'ruleType', e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="numeric">Numeric</option>
                      <option value="pattern">Pattern (Regex)</option>
                      <option value="collection">Valid Values</option>
                    </select>
                    
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => updateRule(index, 'enabled', e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Enabled</span>
                    </label>

                    <button
                      onClick={() => removeRule(index)}
                      className="ml-auto text-red-600 hover:text-red-700 transition-colors"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {renderRuleConfig(rule, index)}

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Error Message (optional):
                    </label>
                    <input
                      type="text"
                      value={rule.errorMessage || ''}
                      onChange={(e) => updateRule(index, 'errorMessage', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      placeholder="Custom error message for this rule"
                    />
                  </div>

                  {!validateRule(rule) && (
                    <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                      ⚠ This rule configuration is incomplete
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={addRule}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Rule
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={saveRules}
              disabled={loading || rules.some(rule => !validateRule(rule))}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckIcon className="w-4 h-4" />
                  Save Rules
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RuleDefinitionDialog;
