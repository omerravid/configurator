import React, { useState, useEffect } from "react";
import { ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { configAPI } from "../services/api";

const ConfigTypeIcon = ({ type, status }) => {
  const getIcon = () => {
    switch (type) {
      case "PRODUCT":
        return (
          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
            P
          </div>
        );
      case "INSTANCE":
        return (
          <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
            I
          </div>
        );
      case "USER":
        return (
          <div
            className={`w-6 h-6 ${status === "DRAFT" ? "bg-orange-500" : "bg-purple-500"} text-white rounded-full flex items-center justify-center text-xs font-bold`}
          >
            U
          </div>
        );
      default:
        return null;
    }
  };

  return getIcon();
};

const TreeNode = ({ config, selectedId, onSelect, level = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(false);

  const loadChildren = async () => {
    if (hasLoadedChildren) return;

    setLoadingChildren(true);
    try {
      const response = await configAPI.getChildren(config.id);
      setChildren(response.data.children || []);
      setHasLoadedChildren(true);
    } catch (error) {
      console.error("Failed to load children:", error);
    } finally {
      setLoadingChildren(false);
    }
  };

  const handleToggle = () => {
    if (!isExpanded && !hasLoadedChildren) {
      loadChildren();
    }
    setIsExpanded(!isExpanded);
  };

  const handleSelect = () => {
    onSelect(config);
  };

  const isSelected = selectedId === config.id;
  const hasChildren = children.length > 0 || !hasLoadedChildren;

  return (
    <div className="select-none">
      <div
        className={`tree-item ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={handleSelect}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="flex-shrink-0 p-1 hover:bg-gray-200 rounded"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </button>
        )}

        {!hasChildren && <div className="w-6" />}

        <ConfigTypeIcon type={config.type} status={config.status} />

        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">
            {config.name}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {config.type}
            {config.status === "DRAFT" && (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                DRAFT
              </span>
            )}
          </div>
        </div>

        {config.parent_name && (
          <div className="text-xs text-gray-400 truncate">
            → {config.parent_name}
          </div>
        )}
      </div>

      {isExpanded && (
        <div>
          {loadingChildren ? (
            <div className="flex justify-center py-2">
              <div className="w-4 h-4 animate-spin border-2 border-gray-300 border-t-primary-600 rounded-full"></div>
            </div>
          ) : (
            children.map((child) => (
              <TreeNode
                key={child.id}
                config={child}
                selectedId={selectedId}
                onSelect={onSelect}
                level={level + 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

const ConfigurationTree = ({
  selectedConfig,
  onConfigSelect,
  refreshTrigger,
}) => {
  const [rootConfigs, setRootConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRootConfigurations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await configAPI.getAll({ type: "PRODUCT" });
      setRootConfigs(response.data.configs || []);
    } catch (err) {
      console.error("Failed to load configurations:", err);
      setError("Failed to load configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRootConfigurations();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="w-6 h-6 animate-spin border-2 border-gray-300 border-t-primary-600 rounded-full mx-auto"></div>
        <p className="text-sm text-gray-500 mt-2">Loading configurations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button
          onClick={loadRootConfigurations}
          className="mt-2 text-xs text-primary-600 hover:text-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (rootConfigs.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-gray-500">No configurations found</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {rootConfigs.map((config) => (
        <TreeNode
          key={config.id}
          config={config}
          selectedId={selectedConfig?.id}
          onSelect={onConfigSelect}
          level={0}
        />
      ))}
    </div>
  );
};

export default ConfigurationTree;
