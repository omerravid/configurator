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
}) => {
  const { showToast } = useToast();
  const [contextMenu, setContextMenu] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(keyName);

  const currentPath = path ? `${path}.${keyName}` : keyName;
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

  // Check if this node has children that are objects or arrays (not scalar values)
  const hasStructuralChildren = () => {
    if (isArray) {
      return actualValue.some(item => {
        const itemActualValue = getActualValue(item);
        return itemActualValue && (typeof itemActualValue === "object" || Array.isArray(itemActualValue));
      });
    }
    if (isObject) {
      return Object.values(actualValue).some(val => {
        const valActualValue = getActualValue(val);
        return valActualValue && (typeof valActualValue === "object" || Array.isArray(valActualValue));
      });
    }
    return false;
  };

  const hasChildren = hasStructuralChildren();

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
        label: "Copy",
        icon: ClipboardIcon,
        onClick: () => copyToClipboard(JSON.stringify(actualValue)),
      },
      {
        label: "Copy as JSON",
        icon: DocumentDuplicateIcon,
        onClick: () => copyToClipboard(JSON.stringify(actualValue, null, 2)),
      }
    );

    // Always add paste option for structural editing if editable
    if (isEditable) {
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
      return actualValue.map((item, index) => {
        const itemActualValue = getActualValue(item);
        // Only show arrays and objects in structure view
        if (itemActualValue && (typeof itemActualValue === "object" || Array.isArray(itemActualValue))) {
          return (
            <StructuralTreeNode
              key={index}
              keyName={index.toString()}
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
            />
          );
        }
        return null;
      }).filter(Boolean);
    }

    return Object.entries(actualValue).map(([key, val]) => {
      const valActualValue = getActualValue(val);
      // Only show arrays and objects in structure view
      if (valActualValue && (typeof valActualValue === "object" || Array.isArray(valActualValue))) {
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

        {/* Folder icon */}
        {hasChildren && (
          <div className="flex-shrink-0 mr-2">
            {isExpanded ? (
              <FolderOpenIcon className="w-4 h-4 text-yellow-600" />
            ) : (
              <FolderIcon className="w-4 h-4 text-yellow-600" />
            )}
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
                  ✕
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
