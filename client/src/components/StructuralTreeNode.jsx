import React, { useState } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  FolderIcon,
  FolderOpenIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClipboardIcon,
  DocumentDuplicateIcon,
  CogIcon,
  CubeIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import ContextMenu from "./ContextMenu";
import { useToast } from "../context/ToastContext";

const StructuralTreeNode = ({
  keyName,
  value,
  path = "",
  depth = 0,
  isRoot = false,
  isEditable = false,
  expandedPaths = new Set(),
  onExpandToggle = () => {},
  onNodeSelect = () => {},
  selectedPath = "",
  onStructuralChange = () => {},
  parentValue = null,
  configType = null,
  configName = null,
  isArrayElement = false,
  arrayIndex = null,
}) => {
  const { showToast } = useToast();
  const [contextMenu, setContextMenu] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(keyName);

  // Handle array element path construction differently - no period before bracket notation
  const currentPath = isArrayElement
    ? `${path}${keyName}` // For array elements like [0], don't add period: "root.ObjArray[0]"
    : path ? `${path}.${keyName}` : keyName; // For regular properties: "root.ObjArray"
  const isExpanded = expandedPaths.has(currentPath);
  const isSelected = currentPath === selectedPath;

  // Extract actual value from provenance wrapper
  const getActualValue = (val) => {
    let currentVal = val;
    while (
      currentVal &&
      typeof currentVal === "object" &&
      currentVal.hasOwnProperty("value") &&
      currentVal.hasOwnProperty("source") &&
      Object.keys(currentVal).length === 2
    ) {
      currentVal = currentVal.value;
    }
    return currentVal;
  };

  const actualValue = getActualValue(value);
  const isObject = actualValue && typeof actualValue === "object" && !Array.isArray(actualValue);
  const isArray = Array.isArray(actualValue);

  // Check if this is a scalar array (array containing only primitive values)
  const isScalarArray = () => {
    if (!isArray) return false;
    return actualValue.every(item => {
      const itemActualValue = getActualValue(item);
      return (
        itemActualValue === null ||
        itemActualValue === undefined ||
        typeof itemActualValue === "string" ||
        typeof itemActualValue === "number" ||
        typeof itemActualValue === "boolean"
      );
    });
  };

  // Check if this node has children that are objects or arrays (not scalar values)
  const hasStructuralChildren = () => {
    if (isArray) {
      // Scalar arrays don't have structural children (they're handled in properties panel)
      if (isScalarArray()) return false;

      // Object arrays have children - each array item becomes a structural child
      return actualValue.length > 0;
    }
    if (isObject) {
      return Object.values(actualValue).some(val => {
        const valActualValue = getActualValue(val);
        // Check if it's a structural element (not a scalar array)
        if (Array.isArray(valActualValue)) {
          // Only include non-scalar arrays
          return !valActualValue.every(item => {
            const itemActual = getActualValue(item);
            return (
              itemActual === null ||
              itemActual === undefined ||
              typeof itemActual === "string" ||
              typeof itemActual === "number" ||
              typeof itemActual === "boolean"
            );
          });
        }
        return valActualValue && typeof valActualValue === "object";
      });
    }
    return false;
  };

  const hasChildren = hasStructuralChildren();

  // Detect if this item is a component reference
  const isComponentReference = () => {
    if (!isObject || !actualValue) return false;
    return actualValue.hasOwnProperty('componentId') &&
           actualValue.hasOwnProperty('versionId') &&
           actualValue.hasOwnProperty('componentName');
  };

  // Detect if this item is a versioned component (has both component data and version metadata)
  const isVersionedComponent = () => {
    if (!isComponentReference()) return false;
    return actualValue.hasOwnProperty('versionName') && actualValue.versionName;
  };

  // Get the appropriate icon for this item
  const getItemIcon = () => {
    if (isRoot) {
      // Root element uses configuration type icon
      return getConfigTypeIcon(configType);
    } else if (isComponentReference()) {
      if (isVersionedComponent()) {
        return <CubeIcon className="w-4 h-4 text-blue-600" title="Versioned Component" />;
      } else {
        return <CogIcon className="w-4 h-4 text-teal-600" title="Component" />;
      }
    } else if (isArray) {
      // Array icon
      return (
        <div className="w-4 h-4 bg-purple-500 text-white rounded flex items-center justify-center text-xs font-bold" title="Array">
          A
        </div>
      );
    } else if (isObject) {
      // Regular object
      return <DocumentIcon className="w-4 h-4 text-gray-600" title="Object" />;
    }
    return null;
  };

  // Get configuration type icon for root
  const getConfigTypeIcon = (type) => {
    switch (type) {
      case "PRODUCT":
        return (
          <div className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="Product">
            P
          </div>
        );
      case "COMPONENT":
        return (
          <div className="w-4 h-4 bg-teal-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="Component">
            C
          </div>
        );
      case "VERSION":
        return (
          <div className="w-4 h-4 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="Version">
            V
          </div>
        );
      case "INSTANCE":
        return (
          <div className="w-4 h-4 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="Instance">
            I
          </div>
        );
      case "USER":
        return (
          <div className="w-4 h-4 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold" title="User Config">
            U
          </div>
        );
      default:
        return <DocumentIcon className="w-4 h-4 text-gray-600" title="Configuration" />;
    }
  };

  const toggleExpanded = () => {
    const newExpandedState = !isExpanded;
    onExpandToggle(currentPath, newExpandedState);
  };

  const handleNodeClick = () => {
    onNodeSelect(currentPath, actualValue);
  };

  const generateUniqueName = (parentValue, baseName = "newObject") => {
    if (!parentValue || typeof parentValue !== "object") return baseName;

    // Ensure baseName is valid
    if (!baseName || typeof baseName !== "string" || baseName.trim() === "") {
      baseName = "newObject";
    }

    const existingKeys = Object.keys(parentValue);
    let counter = 1;
    let newName = baseName;

    while (existingKeys.includes(newName)) {
      newName = `${baseName}${counter}`;
      counter++;
    }

    return newName;
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const menuItems = [];

    // Structural editing (add/rename/remove) only allowed in COMPONENT configurations
    const canDoStructuralEditing = isEditable && configType === "COMPONENT";

    if (canDoStructuralEditing && (isObject || isArray)) {
      menuItems.push({
        label: "Add Object",
        icon: PlusIcon,
        onClick: () => {
          const newName = generateUniqueName(actualValue, "newObject");
          onStructuralChange("add", currentPath, newName, {});
        },
      });
    }

    if (canDoStructuralEditing && !isRoot) {
      menuItems.push({
        label: "Rename",
        icon: PencilIcon,
        onClick: () => setIsRenaming(true),
      });

      menuItems.push({
        label: "Remove",
        icon: TrashIcon,
        onClick: () => {
          // Confirm deletion for safety
          if (window.confirm(`Are you sure you want to remove "${keyName || '(unnamed)'}" and all its contents?`)) {
            onStructuralChange("remove", currentPath);
          }
        },
      });
    }

    menuItems.push(
      {
        label: "Copy Path",
        icon: ClipboardIcon,
        onClick: async () => {
          try {
            // Strip "root." prefix for clean paths
            const cleanPath = currentPath.startsWith("root.") ? currentPath.substring(5) : currentPath;
            console.log("Copying path:", cleanPath);
            await copyToClipboardSilent(cleanPath);
            showToast("Path copied to clipboard", "success");
          } catch (err) {
            console.error("Failed to copy path:", err);
            showToast("Failed to copy path to clipboard", "error");
          }
        },
      },
      {
        label: "Copy JSON",
        icon: DocumentDuplicateIcon,
        onClick: async () => {
          try {
            const jsonString = JSON.stringify(actualValue, null, 2);
            console.log("Copying JSON:", jsonString);
            await copyToClipboardSilent(jsonString);
            showToast("JSON copied to clipboard", "success");
          } catch (err) {
            console.error("Failed to copy JSON:", err);
            showToast("Failed to copy JSON to clipboard", "error");
          }
        },
      }
    );

    // Paste option only for structural editing in COMPONENT configurations
    if (canDoStructuralEditing) {
      menuItems.push({
        label: "Paste",
        icon: DocumentDuplicateIcon,
        onClick: async () => {
          try {
            let clipboardText = "";
            if (navigator.clipboard && navigator.clipboard.readText) {
              clipboardText = await navigator.clipboard.readText();
            } else {
              clipboardText = prompt("Paste JSON data:");
              if (!clipboardText) return;
            }

            const parsedData = JSON.parse(clipboardText);
            const newName = generateUniqueName(actualValue, "pastedItem");
            onStructuralChange("add", currentPath, newName, parsedData);
          } catch (err) {
            showToast("Invalid JSON in clipboard", "error");
          }
        },
      });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: menuItems,
    });
  };

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for iframes
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      showToast("Copied to clipboard!");
    } catch (err) {
      showToast("Failed to copy to clipboard", "error");
    }
  };

  const copyToClipboardSilent = async (text) => {
    if (!text) {
      throw new Error("No text to copy");
    }

    console.log("Attempting to copy text:", text);

    // Try Clipboard API first, but fall back gracefully if blocked
    let clipboardSuccess = false;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        console.log("Trying navigator.clipboard.writeText");
        await navigator.clipboard.writeText(text);
        console.log("Successfully copied with navigator.clipboard");
        clipboardSuccess = true;
      }
    } catch (clipboardError) {
      console.log("Clipboard API failed (likely blocked in iframe):", clipboardError.name);
      // Continue to fallback method
    }

    // Use fallback method if Clipboard API failed or not available
    if (!clipboardSuccess) {
      console.log("Using fallback copy method (execCommand)");
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        textArea.style.opacity = "0";
        textArea.style.pointerEvents = "none";
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999); // For mobile devices

        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error("Both Clipboard API and execCommand failed");
        }
        console.log("Successfully copied with execCommand fallback");
      } catch (fallbackError) {
        console.error("Fallback copy method also failed:", fallbackError);
        throw new Error("Failed to copy to clipboard - both modern and fallback methods failed");
      }
    }
  };

  const handleRename = () => {
    const trimmedValue = renameValue ? renameValue.trim() : "";

    // Validate the new name
    if (!trimmedValue) {
      showToast("Object name cannot be empty", "error");
      return;
    }

    if (trimmedValue === keyName) {
      // No change, just exit rename mode
      setIsRenaming(false);
      return;
    }

    // Check for invalid characters (optional - add any restrictions needed)
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedValue)) {
      showToast("Object name can only contain letters, numbers, underscores, and hyphens", "error");
      return;
    }

    // Check for duplicate names in parent
    if (parentValue && typeof parentValue === "object" && parentValue.hasOwnProperty(trimmedValue)) {
      showToast(`Name "${trimmedValue}" already exists in this location`, "error");
      return;
    }

    // Perform the rename
    onStructuralChange("rename", currentPath, trimmedValue);
    setIsRenaming(false);
    showToast(`Renamed "${keyName}" to "${trimmedValue}"`);
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setRenameValue(keyName);
  };

  const renderChildren = () => {
    if (!hasChildren || !isExpanded) return null;

    if (isArray) {
      // For object arrays, show all items as structural nodes with their index as key
      return actualValue.map((item, index) => {
        return (
          <StructuralTreeNode
            key={index}
            keyName={`[${index}]`}
            value={item}
            path={currentPath}
            depth={depth + 1}
            isEditable={isEditable}
            expandedPaths={expandedPaths}
            onExpandToggle={onExpandToggle}
            onNodeSelect={onNodeSelect}
            selectedPath={selectedPath}
            onStructuralChange={onStructuralChange}
            parentValue={actualValue}
            configType={configType}
            isArrayElement={true}
            arrayIndex={index}
          />
        );
      });
    }

    return Object.entries(actualValue).map(([key, val]) => {
      const valActualValue = getActualValue(val);
      // Only show arrays and objects in structure view, but exclude scalar arrays
      if (valActualValue && (typeof valActualValue === "object" || Array.isArray(valActualValue))) {
        // Skip scalar arrays (they're handled in the properties panel)
        if (Array.isArray(valActualValue)) {
          const isScalar = valActualValue.every(item => {
            const itemActual = getActualValue(item);
            return (
              itemActual === null ||
              itemActual === undefined ||
              typeof itemActual === "string" ||
              typeof itemActual === "number" ||
              typeof itemActual === "boolean"
            );
          });
          if (isScalar) return null;
        }
        return (
          <StructuralTreeNode
            key={key}
            keyName={key}
            value={val}
            path={currentPath}
            depth={depth + 1}
            isEditable={isEditable}
            expandedPaths={expandedPaths}
            onExpandToggle={onExpandToggle}
            onNodeSelect={onNodeSelect}
            selectedPath={selectedPath}
            onStructuralChange={onStructuralChange}
            parentValue={actualValue}
            configType={configType}
          />
        );
      }
      return null;
    }).filter(Boolean);
  };

  const getItemCount = () => {
    if (isArray) return actualValue.length;
    if (isObject) return Object.keys(actualValue).length;
    return 0;
  };

  return (
    <div>
      <div
        className={`flex items-center py-1 px-2 hover:bg-gray-50 rounded cursor-pointer ${
          isSelected ? "bg-blue-50 border-l-2 border-blue-500" : ""
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded();
            }}
            className="flex-shrink-0 p-1 hover:bg-gray-200 rounded mr-1"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        )}

        {!hasChildren && <div className="w-6 mr-1" />}

        {/* Type-specific icon */}
        <div className="flex-shrink-0 mr-2">
          {getItemIcon()}
        </div>

        {/* Root element name */}
        {isRoot && (
          <div className="flex-1 min-w-0">
            <span className="font-medium text-gray-900 truncate">
              {configName || keyName || "Configuration"}
              {hasChildren && (
                <span className="ml-1 text-xs text-gray-500">
                  ({getItemCount()})
                </span>
              )}
            </span>
          </div>
        )}

        {/* Key name */}
        {!isRoot && (
          <div className="flex-1 min-w-0">
            {isRenaming ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") handleRenameCancel();
                  }}
                  className="flex-1 px-1 py-0 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  placeholder="Enter object name"
                />
                <button
                  onClick={handleRename}
                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 focus:outline-none"
                  title="Apply"
                >
                  ✓
                </button>
                <button
                  onClick={handleRenameCancel}
                  className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 focus:outline-none"
                  title="Cancel"
                >
                  ���
                </button>
              </div>
            ) : (
              <span className="font-medium text-gray-700 truncate">
                {keyName || "(unnamed)"}
                {hasChildren && (
                  <span className="ml-1 text-xs text-gray-500">
                    ({getItemCount()})
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Children */}
      {renderChildren()}

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

export default StructuralTreeNode;
