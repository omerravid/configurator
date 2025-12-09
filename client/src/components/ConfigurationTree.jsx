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
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { configAPI } from "../services/api";
import { useToast } from "../context/ToastContext";
import ContextMenu from "./ContextMenu";

const ConfigTypeIcon = React.memo(({ type, status }) => {
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
});

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
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Inheritance Chain</h4>
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
  isArchiveView = false,
}) => {
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [hasLoadedChildren, setHasLoadedChildren] = useState(false);
  const [showInheritanceView, setShowInheritanceView] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  // Load children if node is expanded on mount
  useEffect(() => {
    if (isExpanded && !hasLoadedChildren && !loadingChildren) {
      loadChildren();
    }
  }, [isExpanded]);

  const loadChildren = async () => {
    if (hasLoadedChildren) return;

    setLoadingChildren(true);
    try {
      // In archive view, always include archived children
      // In active view, only include active children
      const includeArchived = isArchiveView;
      const response = await configAPI.getChildren(config.id, includeArchived);
      let childrenData = response.data.children || [];

      // Filter children based on the current view and placeholder status
      if (isArchiveView) {
        if (config._isPlaceholder) {
          // For placeholder parents, we need to show children that are either archived
          // OR have archived descendants. Since we can't easily check descendants here,
          // we'll get all configurations and check each child
          try {
            const allConfigsResponse = await configAPI.getAll(true);
            const allConfigsData = allConfigsResponse.data.configs || [];

            childrenData = childrenData.filter(child => {
              if (Boolean(child.archived)) {
                // Child is archived, definitely show it
                return true;
              }
              // Check if this non-archived child has archived descendants
              const hasArchived = hasArchivedDescendantsHelper(child.id, allConfigsData);
              return hasArchived;
            });
          } catch (error) {
            console.error('Error fetching all configs for archive check:', error);
            // Fallback: show all children if we can't check
            childrenData = childrenData.filter(child => Boolean(child.archived));
          }
        } else {
          // For archived parents, show all children but apply same logic recursively
          // The server already filters based on includeArchived, so we get the right set
        }
      } else {
        // In active view, only show non-archived children
        childrenData = childrenData.filter(child => !Boolean(child.archived));
      }

      // Debug the parent-child relationship
      // Apply placeholder logic to children that have archived descendants
      if (isArchiveView && config._isPlaceholder) {
        childrenData = childrenData.map(child => {
          if (!Boolean(child.archived)) {
            // If this non-archived child was included in the filter above,
            // it means it has archived descendants, so mark it as a placeholder
            return { ...child, _isPlaceholder: true };
          }
          return child;
        });
      }


      setChildren(childrenData);
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
        config.created_by === user?.username &&
        config.status === "DRAFT"
      );
    };

    const canRename = () => user?.role === "ADMIN";

    const canCreateChild = () => {
      if (config.type === "VERSION") return false;
      if (config.type === "USER") return true; // USER configs can have USER children
      if (config.type === "COMPONENT") return user?.role === "ADMIN";
      return user?.role === "ADMIN" || config.type === "PRODUCT";
    };

    const canCommit = () => {
      return (
        (config.type === "USER" || config.type === "VERSION") &&
        config.status === "DRAFT" &&
        (user?.role === "ADMIN" || config.created_by === user?.username)
      );
    };

    const canDelete = () => {
      if (user?.role === "ADMIN") return true;
      return (
        config.type === "USER" &&
        config.created_by === user?.username &&
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

      // For admins, show both Archive and Delete options
      if (user?.role === "ADMIN" && !Boolean(config.archived)) {
        menuItems.push({
          label: `Archive "${config.name}"`,
          icon: TrashIcon,
          onClick: () => onArchive(config),
        });
        menuItems.push({
          label: `Permanently Delete "${config.name}"`,
          icon: XMarkIcon,
          onClick: () => onDelete(config),
        });
      } else if (canDelete()) {
        // Non-admins can only delete their own DRAFT USER configs
        menuItems.push({
          label: `Delete "${config.name}"`,
          icon: XMarkIcon,
          onClick: () => onDelete(config),
        });
      }
    } else {
      // Items for archived configurations (restore + delete for admins)
      if (canRestore()) {
        menuItems.push({
          label: `Restore "${config.name}"`,
          icon: CheckIcon,
          onClick: () => onRestore(config),
        });
      }
      
      // Admins can also delete archived configurations
      if (user?.role === "ADMIN") {
        menuItems.push({
          label: `Permanently Delete "${config.name}"`,
          icon: XMarkIcon,
          onClick: () => onDelete(config),
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
    e.target.style.transform = "rotate(2deg)";

    // Add a custom drag image
    const dragImage = e.target.cloneNode(true);
    dragImage.style.opacity = "0.8";
    dragImage.style.transform = "rotate(2deg)";
    dragImage.style.backgroundColor = "#f3f4f6";
    dragImage.style.border = "2px dashed #6b7280";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = (e) => {
    if (!isDraggable) return;
    e.target.style.opacity = "";
    e.target.style.transform = "";
  };

  const handleDragOver = (e) => {
    if (!isDroppable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragEnter = (e) => {
    if (!isDroppable) return;
    e.preventDefault();
    e.currentTarget.classList.add("bg-blue-50", "border-blue-400", "border-dashed");
    e.currentTarget.style.backgroundColor = "#eff6ff";
    e.currentTarget.style.borderColor = "#60a5fa";
    e.currentTarget.style.borderStyle = "dashed";
  };

  const handleDragLeave = (e) => {
    if (!isDroppable) return;
    e.currentTarget.classList.remove("bg-blue-50", "border-blue-400", "border-dashed");
    e.currentTarget.style.backgroundColor = "";
    e.currentTarget.style.borderColor = "";
    e.currentTarget.style.borderStyle = "";
  };

  const handleDrop = async (e) => {
    if (!isDroppable) return;
    e.preventDefault();

    // Clean up drop zone styling
    e.currentTarget.classList.remove("bg-blue-50", "border-blue-400", "border-dashed");
    e.currentTarget.style.backgroundColor = "";
    e.currentTarget.style.borderColor = "";
    e.currentTarget.style.borderStyle = "";

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
  const hasChildren = config._flatArchive ? false : (children.length > 0 || !hasLoadedChildren);

  return (
    <div className="select-none relative">
      <div
        className={`tree-item ${isSelected ? "selected" : ""} group cursor-context-menu ${
          isDraggable ? "cursor-grab hover:bg-gray-50 dark:hover:bg-gray-700" : ""
        } ${isDroppable ? "border-2 border-transparent transition-colors" : ""} ${
          config._isPlaceholder ? "opacity-50 bg-gray-50 dark:bg-gray-800" : ""
        }`}
        style={{ paddingLeft: `${level * 20 + 12}px` }}
        onClick={config._isPlaceholder ? undefined : handleSelect}
        onContextMenu={config._isPlaceholder ? undefined : handleContextMenu}
        draggable={config._isPlaceholder ? false : isDraggable}
        onDragStart={config._isPlaceholder ? undefined : handleDragStart}
        onDragEnd={config._isPlaceholder ? undefined : handleDragEnd}
        onDragOver={config._isPlaceholder ? undefined : handleDragOver}
        onDragEnter={config._isPlaceholder ? undefined : handleDragEnter}
        onDragLeave={config._isPlaceholder ? undefined : handleDragLeave}
        onDrop={config._isPlaceholder ? undefined : handleDrop}
        title={
          config._isPlaceholder
            ? `Placeholder: ${config.name} (contains archived items)`
            : isDraggable
              ? config.type === "COMPONENT"
                ? `Drag component to add with its root version to a product`
                : `Drag version to add this specific version to a product`
              : isDroppable
                ? "Drop components/versions here to add them to this product"
                : undefined
        }
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
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
          <div className={`text-sm font-medium truncate ${
            config._isPlaceholder
              ? 'text-gray-400 dark:text-gray-500'
              : Boolean(config.archived)
                ? 'text-gray-500 dark:text-gray-400'
                : 'text-gray-900 dark:text-gray-100'
          }`}>
            {config.name}
            {config._isPlaceholder && (
              <span className="ml-1 text-xs text-gray-400">(placeholder)</span>
            )}
            {Boolean(config.archived) && !config._isPlaceholder && (
              <span className="ml-1 text-xs text-gray-400">(archived)</span>
            )}
          </div>
          <div className={`text-xs truncate ${config._isPlaceholder ? 'text-gray-400' : 'text-gray-500'}`}>
            {config.type}
            {config._isPlaceholder && (
              <span className="ml-1 px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">
                PLACEHOLDER
              </span>
            )}
            {config.status === "DRAFT" && !config._isPlaceholder && (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs">
                DRAFT
              </span>
            )}
            {Boolean(config.archived) && !config._isPlaceholder && (
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
                isArchiveView={isArchiveView}
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

// Helper function for TreeNode to check archived descendants
const hasArchivedDescendantsHelper = (configId, allConfigs) => {
  const children = allConfigs.filter(config => {
    const parentId = extractParentId(config.parent_id);
    return parentId === configId;
  });

  for (const child of children) {
    // If this child is archived, we found an archived descendant
    if (Boolean(child.archived)) {
      return true;
    }
    // Recursively check this child's descendants
    if (hasArchivedDescendantsHelper(child.id, allConfigs)) {
      return true;
    }
  }
  return false;
};

// Helper function to extract actual ID from various parent_id formats
const extractParentId = (parentId) => {
  if (!parentId) return null;

  // If it's already a string, return it (unless it's '[object Object]')
  if (typeof parentId === 'string') {
    if (parentId === '[object Object]') {
      // This indicates a database serialization issue - try to find the actual parent
      // For now, log and return null, but we should fix the root cause
      console.warn('Found [object Object] as parent_id - database serialization issue');
      return null;
    }
    return parentId;
  }

  // If it's an object, try to extract the ID
  if (typeof parentId === 'object') {
    // Check common object patterns
    if (parentId.id) return parentId.id;
    if (parentId._id) return parentId._id;
    if (parentId.toString && typeof parentId.toString === 'function') {
      const stringified = parentId.toString();
      if (stringified !== '[object Object]') {
        return stringified;
      }
    }
    return null;
  }

  return String(parentId);
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
  onAddComponent,
  user,
}) => {
  const { showToast } = useToast();
  const [rootConfigs, setRootConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
    // Return the actual state from expandedNodes Set
    return expandedNodes.has(configId);
  };

  const loadRootConfigurations = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      window.location.replace("/login");
      return;
    }
    try {
      // In archive view, we need to load ALL configurations (both active and archived)
      // to properly build the hierarchy and find archived descendants
      const includeArchived = activeTab === 'archived';
      const response = await configAPI.getAll(includeArchived);
      const allConfigs = response.data.configs || [];


      // Filter to show only root-level configs (no parent) - includes PRODUCT and COMPONENT
      let rootConfigs = allConfigs.filter(config => !config.parent_id);

      // Filter by archived status based on active tab
      if (activeTab === 'archived') {

        // Build a flat list of ALL archived configurations (no hierarchy)
        const idMap = new Map(allConfigs.map(c => [c.id, c]));

        const archivedFlat = allConfigs
          .filter(config => Boolean(config.archived))
          .map(config => {
            // Build complete breadcrumb from root to archived item
            const pathNames = [];
            const pathTypes = [];
            let current = config;
            const guard = new Set();

            // Traverse up the hierarchy to build complete ancestry
            while (current) {
              // Add current item to the beginning of the path (root → ... → archived item)
              pathNames.unshift(current.name);
              pathTypes.unshift(current.type);
              guard.add(current.id);

              const parentId = extractParentId(current.parent_id);
              if (!parentId) break; // reached root
              if (guard.has(parentId)) {
                console.warn(`Circular reference detected for ${current.name} (${current.id})`);
                break; // prevent infinite loops
              }

              // Find parent in the configurations map
              current = idMap.get(parentId);
              if (!current) {
                console.warn(`Parent ${parentId} not found for ${pathNames[pathNames.length - 1]}`);
                break;
              }
            }

            // Create enriched breadcrumb with full hierarchy
            const breadcrumb = pathNames.join(' → ');

            return {
              ...config,
              _breadcrumb: breadcrumb,
              _fullPath: pathNames,
              _pathTypes: pathTypes,
              _flatArchive: true
            };
          });

        // Sort by type then name for readability
        rootConfigs = archivedFlat.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name);
          return a.type.localeCompare(b.type);
        });

      } else {
        // Active tab: only non-archived root-level configs
        rootConfigs = rootConfigs.filter(config => !Boolean(config.archived));
      }

      setRootConfigs(rootConfigs);
    } catch (err) {
      // Let global interceptor handle 401/network auth issues
      if (err.response?.status === 401) return;
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') return;

      // Don't show error toast for empty configurations
      if (err.response?.status !== 404) {
        showToast("Failed to load configurations", "error");
      }
      setError("Failed to load configurations");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to check if a configuration has archived descendants
  const hasArchivedDescendants = (configId, allConfigs) => {
    // Handle the parent_id object issue - extract the actual ID if it's an object
    const children = allConfigs.filter(config => {
      const parentId = extractParentId(config.parent_id);
      if (parentId === configId) {
        return true;
      }

      // TEMPORARY WORKAROUND: If parent_id is corrupted ('[object Object]'),
      // try to match based on component-version relationship patterns
      if (config.parent_id === '[object Object]' && config.type === 'VERSION') {
        const parentConfig = allConfigs.find(c => c.id === configId);
        if (parentConfig && parentConfig.type === 'COMPONENT') {
          // This is likely a version of this component
          return true;
        }
      }

      return false;
    });


    for (const child of children) {
      // If this child is archived, we found an archived descendant
      if (Boolean(child.archived)) {
        return true;
      }
      // Recursively check this child's descendants
      if (hasArchivedDescendants(child.id, allConfigs)) {
        return true;
      }
    }

    return false;
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

  return (
    <div className="space-y-1">
      {/* Tab Header - Always visible */}
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

      </div>

      {/* Content Area */}
      {rootConfigs.length === 0 ? (
        <div className="p-4 text-center">
          <p className="text-sm text-gray-500">No configurations found</p>
        </div>
      ) : (
        rootConfigs.map((config) => (
        <TreeNode
          key={config.id}
          config={config}
          selectedId={selectedConfig?.id}
          onSelect={onConfigSelect}
          level={0}

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
          isExpanded={isNodeExpanded(config.id, 0)}
          onExpansionChange={handleExpansionChange}
          isNodeExpanded={isNodeExpanded}
          isArchiveView={activeTab === 'archived'}
        />
        ))
      )}
    </div>
  );
};

export default ConfigurationTree;
