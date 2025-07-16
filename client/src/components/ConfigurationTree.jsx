import React, { useState, useEffect } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  PlusIcon,
  CheckIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { configAPI } from "../services/api";
import ContextMenu from "./ContextMenu";

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

const InheritanceView = ({ config, onClose }) => {
  const [inheritanceData, setInheritanceData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInheritanceData = async () => {
      try {
        const response = await configAPI.getById(config.id, true);
        setInheritanceData(response.data);
      } catch (error) {
        console.error("Failed to load inheritance data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadInheritanceData();
  }, [config.id]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="w-4 h-4 animate-spin border-2 border-gray-300 border-t-primary-600 rounded-full mx-auto"></div>
      </div>
    );
  }

  if (!inheritanceData?.metadata?.chain) {
    return (
      <div className="p-4 text-center text-gray-500">
        No inheritance data available
      </div>
    );
  }

  return (
    <div className="absolute left-full top-0 ml-2 w-80 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-96 overflow-auto">
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-gray-900">Inheritance Chain</h4>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <EyeSlashIcon className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          {inheritanceData.metadata.chainLength} levels merged
        </p>
      </div>

      <div className="p-3 space-y-3">
        {inheritanceData.metadata.chain.map((level, index) => (
          <div key={level.id} className="border border-gray-200 rounded p-2">
            <div className="flex items-center space-x-2 mb-2">
              <ConfigTypeIcon type={level.type} />
              <span className="text-sm font-medium">{level.name}</span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                  level.type === "PRODUCT"
                    ? "bg-blue-100 text-blue-800"
                    : level.type === "INSTANCE"
                      ? "bg-green-100 text-green-800"
                      : "bg-purple-100 text-purple-800"
                }`}
              >
                {level.type}
              </span>
            </div>

            {/* Show what properties this level contributes */}
            <div className="text-xs text-gray-600">
              {index === 0 ? "Base properties" : "Overrides & additions"}
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="text-xs text-gray-600">
          Final resolved configuration combines all levels above
        </div>
      </div>
    </div>
  );
};

const TreeNode = ({
  config,
  selectedId,
  onSelect,
  level = 0,
  showInheritance = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(false);
  const [showInheritanceView, setShowInheritanceView] = useState(false);

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

  const handleInheritanceToggle = (e) => {
    e.stopPropagation();
    setShowInheritanceView(!showInheritanceView);
  };

  const isSelected = selectedId === config.id;
  const hasChildren = children.length > 0 || !hasLoadedChildren;

  return (
    <div className="select-none relative">
      <div
        className={`tree-item ${isSelected ? "selected" : ""} group`}
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

        {/* Inheritance view toggle button */}
        {(config.type === "INSTANCE" || config.type === "USER") && (
          <button
            onClick={handleInheritanceToggle}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 rounded ml-2"
            title="Show inheritance chain"
          >
            <EyeIcon className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Inheritance View */}
      {showInheritanceView && (
        <InheritanceView
          config={config}
          onClose={() => setShowInheritanceView(false)}
        />
      )}

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
                showInheritance={showInheritance}
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
  onEdit,
  onRename,
  onDuplicate,
  onCreateChild,
  onCommit,
  onDelete,
  user,
}) => {
  const [rootConfigs, setRootConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInheritance, setShowInheritance] = useState(false);

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
      {/* Header with inheritance toggle */}
      <div className="px-4 py-2 border-b border-gray-200">
        <label className="flex items-center space-x-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={showInheritance}
            onChange={(e) => setShowInheritance(e.target.checked)}
            className="rounded"
          />
          <span>Show inheritance details</span>
        </label>
      </div>

      {rootConfigs.map((config) => (
        <TreeNode
          key={config.id}
          config={config}
          selectedId={selectedConfig?.id}
          onSelect={onConfigSelect}
          level={0}
          showInheritance={showInheritance}
        />
      ))}
    </div>
  );
};

export default ConfigurationTree;
