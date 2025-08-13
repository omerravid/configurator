import React, { useState, useEffect } from "react";
import { configAPI } from "../services/api";
import {
  PlayIcon,
  ClipboardIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const PathQueryPanel = ({ configurations = [], selectedConfig }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState("");
  const [queryPath, setQueryPath] = useState("");
  const [queryResult, setQueryResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastQuery, setLastQuery] = useState(null);

  // Update selected config when prop changes
  useEffect(() => {
    if (selectedConfig) {
      setSelectedConfigId(selectedConfig.id);
    }
  }, [selectedConfig]);

  const executeQuery = async () => {
    if (!selectedConfigId) {
      setError("Please select a configuration");
      return;
    }

    setLoading(true);
    setError(null);
    setQueryResult(null);

    try {
      const configName =
        configurations.find((c) => c.id === selectedConfigId)?.name ||
        selectedConfigId;
      const queryInfo = {
        configId: selectedConfigId,
        configName,
        path: queryPath || "(root)",
        timestamp: new Date().toISOString(),
      };

      if (!queryPath.trim()) {
        // Get complete configuration using minimal response
        const response = await configAPI.getByPath(selectedConfigId, "", true);
        setQueryResult({
          data: response.data, // This is the raw value/object with minimal=true
          query: queryInfo,
          isMinimal: true,
        });
      } else {
        // Get specific path - strip "root." prefix if present
        const cleanPath = queryPath.startsWith("root.")
          ? queryPath.substring(5)
          : queryPath;
        const response = await configAPI.getByPath(selectedConfigId, cleanPath, true);
        setQueryResult({
          data: response.data, // This is the raw value with minimal=true
          query: queryInfo,
          isMinimal: true,
        });
      }

      setLastQuery(queryInfo);
    } catch (err) {
      console.error("Query failed:", err);

      // Handle 404 as a special case - path doesn't exist
      if (err.response?.status === 404) {
        setQueryResult({
          data: null,
          query: {
            configId: selectedConfigId,
            configName: configurations.find((c) => c.id === selectedConfigId)?.name || selectedConfigId,
            path: queryPath || "(root)",
            timestamp: new Date().toISOString(),
          },
          isMinimal: true,
          notFound: true,
        });
        setError(null);
      } else {
        setError(err.response?.data?.error || err.message || "Query failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setQueryPath(text);
    } catch (err) {
      console.error("Failed to paste:", err);
    }
  };

  const copyResult = async () => {
    if (!queryResult) return;

    try {
      let textToCopy;

      if (queryResult.notFound) {
        textToCopy = `Path not found: ${queryResult.query.path}`;
      } else if (queryResult.isMinimal) {
        // For minimal responses, copy the raw value
        if (typeof queryResult.data === 'string') {
          textToCopy = queryResult.data;
        } else if (typeof queryResult.data === 'number' || typeof queryResult.data === 'boolean') {
          textToCopy = String(queryResult.data);
        } else if (queryResult.data === null) {
          textToCopy = 'null';
        } else {
          textToCopy = JSON.stringify(queryResult.data, null, 2);
        }
      } else {
        textToCopy = JSON.stringify(queryResult.data, null, 2);
      }

      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const formatResult = (data) => {
    if (data === null || data === undefined) {
      return <span className="text-gray-400 italic">null</span>;
    }

    if (typeof data === "string") {
      return <span className="text-green-600">"{data}"</span>;
    }

    if (typeof data === "number") {
      return <span className="text-blue-600">{data}</span>;
    }

    if (typeof data === "boolean") {
      return <span className="text-purple-600">{String(data)}</span>;
    }

    if (typeof data === "object") {
      return (
        <pre className="text-sm text-gray-700 bg-gray-50 p-3 rounded border overflow-auto max-h-64">
          {JSON.stringify(data, null, 2)}
        </pre>
      );
    }

    return <span className="text-gray-600">{String(data)}</span>;
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition-colors">
      {/* Panel Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronUpIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
          <span>REST API Query Panel</span>
          {lastQuery && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Last: {lastQuery.configName} → {lastQuery.path}
            </span>
          )}
        </button>
      </div>

      {/* Panel Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {/* Query Form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Configuration Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Configuration
              </label>
              <select
                value={selectedConfigId}
                onChange={(e) => setSelectedConfigId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
              >
                <option value="">Select configuration...</option>
                {configurations.map((config) => (
                  <option key={config.id} value={config.id}>
                    {config.type}: {config.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Path Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Path (empty for complete config)
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={queryPath}
                  onChange={(e) => setQueryPath(e.target.value)}
                  placeholder="e.g., system.logging.level"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") executeQuery();
                  }}
                />
                <button
                  onClick={handlePaste}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors"
                  title="Paste from clipboard"
                >
                  <ClipboardIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Execute Button */}
            <div className="flex items-end">
              <button
                onClick={executeQuery}
                disabled={loading || !selectedConfigId}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full"></div>
                ) : (
                  <PlayIcon className="w-4 h-4" />
                )}
                <span>{loading ? "Querying..." : "Execute Query"}</span>
              </button>
            </div>
          </div>

          {/* API Info */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded border">
            <strong>API Endpoint:</strong> GET /api/configs/
            {selectedConfigId || "{id}"}/data
            {queryPath && <span>?path={encodeURIComponent(queryPath)}</span>}
            <span className="text-green-600">&minimal=true</span>
            <br />
            <strong>Example:</strong> GET /api/configs/{selectedConfigId || "prod_ecommerce"}/data
            {queryPath ? `?path=${encodeURIComponent(queryPath)}&minimal=true` : "?minimal=true"}
            <br />
            <strong>Response:</strong> Returns the raw value only (string, number, boolean, object, or array)
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center space-x-2 text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
              <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Result Display */}
          {queryResult && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-900">
                    Query Result
                  </span>
                  {queryResult.isMinimal && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Minimal Response
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    {queryResult.query.configName} → {queryResult.query.path}
                  </span>
                </div>
                <button
                  onClick={copyResult}
                  className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-white"
                >
                  Copy Result
                </button>
              </div>

              <div className="space-y-2">
                {queryResult.notFound ? (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">
                      Path not found | Time:{" "}
                      {new Date(queryResult.query.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded border">
                      <ExclamationTriangleIcon className="w-5 h-5" />
                      <span>The specified path does not exist in this configuration.</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs text-gray-500">
                      Type: {typeof queryResult.data} | Size:{" "}
                      {JSON.stringify(queryResult.data).length} chars | Time:{" "}
                      {new Date(queryResult.query.timestamp).toLocaleTimeString()}
                    </div>
                    {formatResult(queryResult.data)}
                  </div>
                )}
              </div>

              {/* Metadata if available */}
              {queryResult.metadata && Array.isArray(queryResult.metadata) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">
                    Inheritance Chain:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {queryResult.metadata.map((meta, index) => (
                      <div
                        key={index}
                        className={`px-2 py-1 rounded text-xs ${
                          meta.type === "PRODUCT"
                            ? "bg-blue-100 text-blue-800"
                            : meta.type === "INSTANCE"
                              ? "bg-green-100 text-green-800"
                              : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {meta.type}: {meta.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PathQueryPanel;
