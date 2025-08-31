import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  DocumentTextIcon,
  CheckIcon,
  ArrowPathIcon,
  PlusIcon,
  TrashIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import { useToast } from '../context/ToastContext';
import { parsePprmToJson, jsonToPprm, validatePprmFormat, getPprmStats } from '../utils/pprmParser';

const PprmEditor = ({ 
  isOpen, 
  onClose, 
  pprmContent, 
  filename,
  onSave 
}) => {
  const { showToast } = useToast();
  const [jsonData, setJsonData] = useState({ variables: {} });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({});
  const [selectedVariable, setSelectedVariable] = useState('');
  const [newVariableName, setNewVariableName] = useState('');

  useEffect(() => {
    if (isOpen && pprmContent) {
      try {
        const parsed = parsePprmToJson(pprmContent);
        setJsonData(parsed);
        setStats(getPprmStats(parsed));
        
        // Select first variable by default
        const varNames = Object.keys(parsed.variables);
        if (varNames.length > 0) {
          setSelectedVariable(varNames[0]);
        }
      } catch (error) {
        showToast(`Failed to parse PPRM file: ${error.message}`, 'error');
        console.error('PPRM parsing error:', error);
      }
    }
  }, [isOpen, pprmContent, showToast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const pprmOutput = jsonToPprm(jsonData);
      const validation = validatePprmFormat(pprmOutput);
      
      if (!validation.isValid) {
        showToast(`Validation failed: ${validation.errors.join(', ')}`, 'error');
        return;
      }
      
      await onSave(pprmOutput);
      showToast('PPRM file saved successfully', 'success');
      onClose();
    } catch (error) {
      showToast(`Failed to save PPRM file: ${error.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const addVariable = () => {
    if (!newVariableName.trim()) {
      showToast('Please enter a variable name', 'error');
      return;
    }
    
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(newVariableName)) {
      showToast('Variable name must start with letter or underscore and contain only letters, numbers, and underscores', 'error');
      return;
    }
    
    if (jsonData.variables[newVariableName]) {
      showToast('Variable already exists', 'error');
      return;
    }
    
    const newData = {
      ...jsonData,
      variables: {
        ...jsonData.variables,
        [newVariableName]: ['']
      }
    };
    
    setJsonData(newData);
    setStats(getPprmStats(newData));
    setSelectedVariable(newVariableName);
    setNewVariableName('');
    showToast(`Variable "${newVariableName}" added`, 'success');
  };

  const deleteVariable = (varName) => {
    if (!window.confirm(`Are you sure you want to delete variable "${varName}" and all its values?`)) {
      return;
    }
    
    const newVariables = { ...jsonData.variables };
    delete newVariables[varName];
    
    const newData = { ...jsonData, variables: newVariables };
    setJsonData(newData);
    setStats(getPprmStats(newData));
    
    // Select another variable if current one was deleted
    if (selectedVariable === varName) {
      const remainingVars = Object.keys(newVariables);
      setSelectedVariable(remainingVars.length > 0 ? remainingVars[0] : '');
    }
    
    showToast(`Variable "${varName}" deleted`, 'success');
  };

  const updateVariableValue = (varName, index, value) => {
    const newData = {
      ...jsonData,
      variables: {
        ...jsonData.variables,
        [varName]: jsonData.variables[varName].map((v, i) => i === index ? value : v)
      }
    };
    setJsonData(newData);
    setStats(getPprmStats(newData));
  };

  const addValueToVariable = (varName) => {
    const newData = {
      ...jsonData,
      variables: {
        ...jsonData.variables,
        [varName]: [...jsonData.variables[varName], '']
      }
    };
    setJsonData(newData);
    setStats(getPprmStats(newData));
  };

  const removeValueFromVariable = (varName, index) => {
    if (jsonData.variables[varName].length <= 1) {
      showToast('Cannot remove the last value. Delete the variable instead.', 'error');
      return;
    }
    
    const newData = {
      ...jsonData,
      variables: {
        ...jsonData.variables,
        [varName]: jsonData.variables[varName].filter((_, i) => i !== index)
      }
    };
    setJsonData(newData);
    setStats(getPprmStats(newData));
  };

  if (!isOpen) return null;

  const variables = Object.keys(jsonData.variables).sort();
  const currentVariable = selectedVariable && jsonData.variables[selectedVariable] ? 
    jsonData.variables[selectedVariable] : [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <DocumentTextIcon className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                PPRM Editor
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {filename} • {stats.variableCount} variables • {stats.totalValues} values
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Variables List */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Variables
              </h3>
              
              {/* Add New Variable */}
              <div className="flex space-x-2 mb-3">
                <input
                  type="text"
                  value={newVariableName}
                  onChange={(e) => setNewVariableName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addVariable()}
                  placeholder="New variable name"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button
                  onClick={addVariable}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {/* Variables List */}
            <div className="flex-1 overflow-auto">
              {variables.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No variables found
                </div>
              ) : (
                variables.map(varName => (
                  <div
                    key={varName}
                    className={`p-3 border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedVariable === varName ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''
                    }`}
                    onClick={() => setSelectedVariable(varName)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {varName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {jsonData.variables[varName].length} values
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteVariable(varName);
                        }}
                        className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Variable Editor */}
          <div className="flex-1 flex flex-col">
            {selectedVariable ? (
              <>
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {selectedVariable}
                    </h3>
                    <button
                      onClick={() => addValueToVariable(selectedVariable)}
                      className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <PlusIcon className="w-4 h-4" />
                      <span>Add Value</span>
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto p-4">
                  <div className="space-y-3">
                    {currentVariable.map((value, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="w-12 text-sm text-gray-500 text-right">
                          [{index}]
                        </div>
                        <input
                          type="text"
                          value={String(value)}
                          onChange={(e) => updateVariableValue(selectedVariable, index, e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          onClick={() => removeValueFromVariable(selectedVariable, index)}
                          className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <InformationCircleIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Select a variable to edit its values</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Format: VarName[Index]=Value
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckIcon className="w-4 h-4" />
              )}
              <span>Save PPRM File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PprmEditor;
