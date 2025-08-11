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
}) => {
  const { showToast } = useToast();
  const [contextMenu, setContextMenu] = useState(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(keyName);

  const currentPath = path ? `${path}.${keyName}` : keyName;
  const isExpanded = expandedPaths.has(currentPath) || (expandedPaths.size === 0 && depth < 2);
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
  const hasChildren = isObject || isArray;

  const toggleExpanded = () => {
    onExpandToggle(currentPath, !isExpanded);
  };

  const handleNodeClick = () => {
    onNodeSelect(currentPath, actualValue);
  };

  const generateUniqueName = (parentValue, baseName = "newItem") => {
    if (!parentValue || typeof parentValue !== "object") return baseName;
    
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

    if (isEditable && (isObject || isArray)) {
      menuItems.push({
        label: "Add Object",
        icon: PlusIcon,
        onClick: () => {
          const newName = generateUniqueName(actualValue, "newObject");
          onStructuralChange("add", currentPath, newName, {});
        },
      });
    }

    if (isEditable && !isRoot) {
      menuItems.push({
        label: "Rename",
        icon: PencilIcon,
        onClick: () => setIsRenaming(true),
      });

      menuItems.push({
        label: "Remove",
        icon: TrashIcon,
        onClick: () => {
          onStructuralChange("remove", currentPath);
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
    if (renameValue && renameValue !== keyName) {
      onStructuralChange("rename", currentPath, renameValue);
    }
    setIsRenaming(false);
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
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") handleRenameCancel();
                }}
                onBlur={handleRename}
                className="px-1 py-0 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <span className="font-medium text-gray-700 truncate">
                {keyName}
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
