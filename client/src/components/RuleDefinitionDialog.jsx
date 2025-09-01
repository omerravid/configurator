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
    console.log("=== RuleDefinitionDialog useEffect ===");
    console.log("isOpen:", isOpen);
    console.log("existingRules:", existingRules);
    console.log("existingRules type:", typeof existingRules);
    console.log("existingRules isArray:", Array.isArray(existingRules));

    if (isOpen) {
      // Ensure existingRules is an array before mapping
      const rulesArray = Array.isArray(existingRules) ? existingRules : [];
      console.log("rulesArray:", rulesArray);
      const mappedRules = rulesArray.map(rule => ({ ...rule, isExisting: true }));
      console.log("mappedRules:", mappedRules);
      setRules(mappedRules);
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

  const updateCollectionValues = (index, valuesString) => {
    const validValues = valuesString.split(',').map(v => v.trim()).filter(v => v !== '');
    updateRuleConfig(index, 'validValues', validValues);
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
            propertyPath: propertyPath, // Use dialog propertyPath prop, not rule.propertyPath
            ruleType: rule.ruleType,
            ruleConfig: rule.ruleConfig,
            errorMessage: rule.errorMessage,
            enabled: rule.enabled
          };
          console.log("Create rule payload:", payload);
          console.log("Dialog propertyPath prop:", propertyPath);
          console.log("Rule propertyPath:", rule.propertyPath);
          console.log("Are they equal?", propertyPath === rule.propertyPath);

          console.log("Making POST request to /api/rules...");
          const response = await fetch('/api/rules', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
          });

          console.log("Create rule response status:", response.status);
          console.log("Create rule response headers:", Object.fromEntries(response.headers.entries()));

          if (!response.ok) {
            const errorData = await response.text();
            console.error("Create rule failed:", errorData);
            console.error("Response status:", response.status, response.statusText);
            throw new Error(`Failed to create rule: ${response.status} ${errorData}`);
          }

          const createdRule = await response.json();
          console.log("Rule created successfully:", createdRule);
          console.log("Created rule ID:", createdRule.id);
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

      // Verify save by immediately fetching the rules back
      console.log("=== VERIFICATION: Fetching rules immediately after save ===");
      try {
        const verifyResponse = await fetch(`/api/rules/configuration/${configurationId}/path/${encodeURIComponent(propertyPath)}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        console.log("Verification fetch status:", verifyResponse.status);
        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          console.log("Verification: Raw API response:", verifyData);
          // API returns { rules: [...] } so extract the rules array
          const verifyRules = Array.isArray(verifyData.rules) ? verifyData.rules : (Array.isArray(verifyData) ? verifyData : []);
          console.log("Verification: Rules found after save:", verifyRules);
          console.log("Number of rules found:", verifyRules.length);
        } else {
          console.error("Verification fetch failed:", verifyResponse.status);
        }
      } catch (verifyError) {
        console.error("Verification fetch error:", verifyError);
      }

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

  const renderCompactRuleConfig = (rule, index) => {
    switch (rule.ruleType) {
      case 'numeric':
        return (
          <>
            <select
              value={rule.ruleConfig.operator || 'greater'}
              onChange={(e) => updateRuleConfig(index, 'operator', e.target.value)}
              className="w-20 px-1 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
            >
              <option value="greater">&gt;</option>
              <option value="greaterEquals">≥</option>
              <option value="smaller">&lt;</option>
              <option value="smallerEquals">≤</option>
              <option value="equals">=</option>
            </select>
            <input
              type="number"
              value={rule.ruleConfig.value || 0}
              onChange={(e) => updateRuleConfig(index, 'value', parseFloat(e.target.value))}
              className="w-16 px-1 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
              placeholder="0"
            />
          </>
        );

      case 'pattern':
        return (
          <>
            <input
              type="text"
              value={rule.ruleConfig.pattern || ''}
              onChange={(e) => updateRuleConfig(index, 'pattern', e.target.value)}
              className="w-32 px-1 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
              placeholder="regex pattern"
            />
            <input
              type="text"
              value={rule.ruleConfig.flags || ''}
              onChange={(e) => updateRuleConfig(index, 'flags', e.target.value)}
              className="w-12 px-1 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
              placeholder="flags"
            />
          </>
        );

      case 'collection':
        return (
          <input
            type="text"
            value={rule.ruleConfig.validValues?.join(', ') || ''}
            onChange={(e) => updateCollectionValues(index, e.target.value)}
            className="w-40 px-1 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
            placeholder="value1, value2, value3"
          />
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Rules for {propertyPath}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {rules.length === 0 ? (
            <div className="text-center py-6">
              <ExclamationTriangleIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No rules defined for this property
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 dark:text-gray-400 font-medium pb-1 border-b border-gray-200">
                <div className="col-span-2">Type</div>
                <div className="col-span-4">Configuration</div>
                <div className="col-span-4">Error Message</div>
                <div className="col-span-1">On</div>
                <div className="col-span-1">Actions</div>
              </div>

              {/* Rule rows */}
              {rules.map((rule, index) => (
                <div key={rule.id || index} className={`grid grid-cols-12 gap-2 items-center py-1 px-1 rounded text-xs ${!validateRule(rule) ? 'bg-red-50 border border-red-200' : 'hover:bg-gray-50'}`}>
                  {/* Rule Type */}
                  <div className="col-span-2">
                    <select
                      value={rule.ruleType}
                      onChange={(e) => updateRule(index, 'ruleType', e.target.value)}
                      className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
                    >
                      <option value="numeric">Numeric</option>
                      <option value="pattern">Pattern</option>
                      <option value="collection">Collection</option>
                    </select>
                  </div>

                  {/* Rule Configuration */}
                  <div className="col-span-4 flex gap-1 items-center">
                    {renderCompactRuleConfig(rule, index)}
                  </div>

                  {/* Error Message */}
                  <div className="col-span-4">
                    <input
                      type="text"
                      value={rule.errorMessage || ''}
                      onChange={(e) => updateRule(index, 'errorMessage', e.target.value)}
                      className="w-full px-1 py-1 text-xs border border-gray-300 rounded bg-white text-gray-900"
                      placeholder="Custom error message"
                    />
                  </div>

                  {/* Enabled Checkbox */}
                  <div className="col-span-1 text-center">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateRule(index, 'enabled', e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </div>

                  {/* Actions */}
                  <div className="col-span-1 text-center">
                    <button
                      onClick={() => removeRule(index)}
                      className="text-red-600 hover:text-red-700 transition-colors"
                      title="Delete rule"
                    >
                      <TrashIcon className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Helper text for rule types */}
          <div className="mt-3 text-xs text-gray-500 space-y-1">
            <div><strong>Numeric:</strong> Choose operator (&gt;, ≥, &lt;, ≤, =) and comparison value</div>
            <div><strong>Pattern:</strong> Enter regex pattern and optional flags (e.g., 'i' for case-insensitive)</div>
            <div><strong>Collection:</strong> Enter comma-separated list of valid values</div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={addRule}
            className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            Add Rule
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={saveRules}
              disabled={loading || rules.some(rule => !validateRule(rule))}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
