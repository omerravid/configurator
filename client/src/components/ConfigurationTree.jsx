import React, { useState, useEffect, useRef, useCallback } from "react";
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
  LockClosedIcon,
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
          <div className="relative">
            <div
              className={`w-6 h-6 ${status === "DRAFT" ? "bg-orange-500" : "bg-purple-500"} text-white rounded-full flex items-center justify-center text-xs font-bold`}
            >
              U
            </div>
            {status === "COMMITTED" && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-700 rounded-full flex items-center justify-center">
                <LockClosedIcon className="w-2 h-2 text-white" />
              </div>
            )}
          </div>
        );
      case "COMPONENT":
        return (
          <div className="w-6 h-6 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
            C
          </div>
        );
      case "VERSION":
        return (
          <div className="relative">
            <div
              className={`w-6 h-6 ${status === "DRAFT" ? "bg-amber-500" : "bg-indigo-500"} text-white rounded-full flex items-center justify-center text-xs font-bold`}
            >
              V
            </div>
            {status === "COMMITTED" && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gray-700 rounded-full flex items-center justify-center">
                <LockClosedIcon className="w-2 h-2 text-white" />
              </div>
            )}
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
  onEdit,
  onRename,
  onDuplicate,
  onCreateChild,
  onCommit,
  onDelete,
  onArchive,
  onRestore,
  onAddComponent,
  user,
  isExpanded,
  onExpansionChange,
  isNodeExpanded,
}) => {
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(false);
  const [showInheritanceView, setShowInheritanceView] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);


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
    onExpansionChange(config.id, !isExpanded);
  };

  const handleSelect = () => {
    onSelect(config);
  };

  const handleInheritanceToggle = (e) => {
    e.stopPropagation();
    setShowInheritanceView(!showInheritanceView);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Helper functions to check permissions
    const canEdit = () => {
      if (user?.role === "ADMIN") return true;
      return (
        config.type === "USER" &&
        config.created_by === user?.id &&
        config.status === "DRAFT"
      );
    };

    const canRename = () => user?.role === "ADMIN";

    const canCreateChild = () => {
      if (config.type === "USER" || config.type === "VERSION") return false;
      if (config.type === "COMPONENT") return user?.role === "ADMIN";
      return user?.role === "ADMIN" || config.type === "PRODUCT";
    };

    const canCommit = () => {
      return (
        (config.type === "USER" || config.type === "VERSION") &&
        config.status === "DRAFT" &&
        (user?.role === "ADMIN" || config.created_by === user?.id)
      );
    };

    const canDelete = () => {
      if (user?.role === "ADMIN") return true;
      return (
        config.type === "USER" &&
        config.created_by === user?.id &&
        config.status === "DRAFT"
      );
    };

    const canArchive = () => {
      return user?.role === "ADMIN" && !Boolean(config.archived);
    };

    const canRestore = () => {
      return user?.role === "ADMIN" && Boolean(config.archived);
    };

    const menuItems = [];

    if (!Boolean(config.archived)) {
      // Items for active configurations
      menuItems.push(
        {
          label: `Edit ${config.type.toLowerCase()} configuration`,
          icon: PencilIcon,
          onClick: () => onEdit(config),
          disabled: !canEdit(),
        },
        {
          label: `Rename "${config.name}"`,
          icon: DocumentTextIcon,
          onClick: () => onRename(config),
          disabled: !canRename(),
        },
        {
          label: `Duplicate as sibling`,
          icon: DocumentDuplicateIcon,
          onClick: () => onDuplicate(config),
        },
        {
          label: `Create child configuration`,
          icon: PlusIcon,
          onClick: () => onCreateChild(config),
          disabled: !canCreateChild(),
        }
      );

      if (canCommit()) {
        menuItems.push({
          label: "Commit configuration",
          icon: CheckIcon,
          onClick: () => onCommit(config),
        });
      }

      if (canArchive()) {
        menuItems.push({
          label: `Archive "${config.name}"`,
          icon: TrashIcon,
          onClick: () => onArchive(config),
        });
      } else if (canDelete()) {
        menuItems.push({
          label: `Delete "${config.name}"`,
          icon: TrashIcon,
          onClick: () => onDelete(config),
        });
      }
    } else {
      // Items for archived configurations (view only + restore)
      if (canRestore()) {
        menuItems.push({
          label: `Restore "${config.name}"`,
          icon: CheckIcon,
          onClick: () => onRestore(config),
        });
      }
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: menuItems,
    });
  };

  // Drag and drop handlers
  const isDraggable = (config.type === "COMPONENT" || config.type === "VERSION") && !Boolean(config.archived);
  const isDroppable = config.type === "PRODUCT" && !Boolean(config.archived);

  const handleDragStart = (e) => {
    if (!isDraggable) return;

    e.dataTransfer.setData("text/plain", JSON.stringify({
      id: config.id,
      name: config.name,
      type: config.type
    }));
    e.dataTransfer.effectAllowed = "copy";

    // Add visual feedback
    e.target.style.opacity = "0.5";
  };

  const handleDragEnd = (e) => {
    if (!isDraggable) return;
    e.target.style.opacity = "";
  };

  const handleDragOver = (e) => {
    if (!isDroppable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragEnter = (e) => {
    if (!isDroppable) return;
    e.preventDefault();
    e.target.classList.add("bg-blue-100", "border-blue-300");
  };

  const handleDragLeave = (e) => {
    if (!isDroppable) return;
    e.target.classList.remove("bg-blue-100", "border-blue-300");
  };

  const handleDrop = async (e) => {
    if (!isDroppable) return;
    e.preventDefault();
    e.target.classList.remove("bg-blue-100", "border-blue-300");

    try {
      const draggedData = JSON.parse(e.dataTransfer.getData("text/plain"));

      // Call the onAddComponent function if provided
      if (onAddComponent) {
        await onAddComponent(config.id, draggedData);
      }
    } catch (error) {
      console.error("Failed to handle drop:", error);
    }
  };

  const isSelected = selectedId === config.id;
  const hasChildren = children.length > 0 || !hasLoadedChildren;

  return (
    <div className="select-none relative">
      <div
        className={`tree-item ${isSelected ? "selected" : ""} group cursor-context-menu ${
          isDraggable ? "cursor-grab" : ""
        } ${isDroppable ? "border-2 border-transparent" : ""}`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
        draggable={isDraggable}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
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
          <div className={`text-sm font-medium truncate ${Boolean(config.archived) ? 'text-gray-500' : 'text-gray-900'}`}>
            {config.name}
            {Boolean(config.archived) && (
              <span className="ml-1 text-xs text-gray-400">(archived)</span>
            )}
          </div>
          <div className="text-xs text-gray-500 truncate">
            {config.type}
            {config.status === "DRAFT" && (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                DRAFT
              </span>
            )}
            {Boolean(config.archived) && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                ARCHIVED
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
                onEdit={onEdit}
                onRename={onRename}
                onDuplicate={onDuplicate}
                onCreateChild={onCreateChild}
                onCommit={onCommit}
                onDelete={onDelete}
                onArchive={onArchive}
                onRestore={onRestore}
                onAddComponent={onAddComponent}
                user={user}
                isExpanded={isNodeExpanded(child.id, level + 1)}
                onExpansionChange={onExpansionChange}
                isNodeExpanded={isNodeExpanded}
              />
            ))
          )}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
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
  onArchive,
  onRestore,
  user,
}) => {
  const [rootConfigs, setRootConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showInheritance, setShowInheritance] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'archived'

  // Global expansion state management - persist across refreshes and per tab
  const getStoredExpansionState = () => {
    try {
      const storageKey = `configTree-expandedNodes-${activeTab}`;
      const stored = localStorage.getItem(storageKey);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const [expandedNodes, setExpandedNodes] = useState(getStoredExpansionState);

  // Update expansion state when tab changes
  useEffect(() => {
    setExpandedNodes(getStoredExpansionState());
  }, [activeTab]);


  // Handle expansion state changes
  const handleExpansionChange = (configId, isExpanded) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.add(configId);
      } else {
        newSet.delete(configId);
      }
      // Persist to localStorage with tab-specific key
      try {
        const storageKey = `configTree-expandedNodes-${activeTab}`;
        localStorage.setItem(storageKey, JSON.stringify([...newSet]));
      } catch (err) {
        console.warn('Failed to save expansion state to localStorage:', err);
      }
      return newSet;
    });
  };

  // Check if a node should be expanded
  const isNodeExpanded = (configId, level = 0) => {
    // If explicitly set in state, use that
    if (expandedNodes.has(configId)) {
      return true;
    }
    // Start with all items collapsed so expansion can be tested
    return false;
  };

  const loadRootConfigurations = async () => {
    setLoading(true);
    setError(null);
    try {
      const includeArchived = activeTab === 'archived';
      const response = await configAPI.getAll(includeArchived);
      // Filter to show root-level configs (no parent) - includes PRODUCT and COMPONENT
      let rootConfigs = (response.data.configs || []).filter(config => !config.parent_id);

      // Filter by archived status based on active tab
      if (activeTab === 'archived') {
        rootConfigs = rootConfigs.filter(config => Boolean(config.archived));
      } else {
        rootConfigs = rootConfigs.filter(config => !Boolean(config.archived));
      }

      setRootConfigs(rootConfigs);
    } catch (err) {
      console.error("Failed to load configurations:", err);
      setError("Failed to load configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRootConfigurations();
  }, [refreshTrigger, activeTab]);


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
      {/* Tab Header */}
      <div className="px-4 py-2 border-b border-gray-200">
        <div className="flex space-x-1 mb-3">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-3 py-1 text-sm font-medium rounded ${
              activeTab === 'active'
                ? 'bg-primary-100 text-primary-700 border border-primary-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`px-3 py-1 text-sm font-medium rounded ${
              activeTab === 'archived'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Archived
          </button>
        </div>

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
          onEdit={onEdit}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onCreateChild={onCreateChild}
          onCommit={onCommit}
          onDelete={onDelete}
          onArchive={onArchive}
          onRestore={onRestore}
          user={user}
          isExpanded={isNodeExpanded(config.id, 0)}
          onExpansionChange={handleExpansionChange}
          isNodeExpanded={isNodeExpanded}
        />
      ))}
    </div>
  );
};

export default ConfigurationTree;
