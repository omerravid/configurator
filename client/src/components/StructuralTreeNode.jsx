import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, PlusIcon, TrashIcon, PencilIcon, ClipboardIcon, DocumentDuplicateIcon, CheckIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";
import ContextMenu from "./ContextMenu";

const StructuralTreeNode = ({
  nodeData,
  path = "root",
  level = 0,
  isEditable,
  configType,
  onValueChange,
  onPropertyAdd,
  onPropertyDelete,
  onStructuralChange,
  expandedPaths,
  setExpandedPaths,
  selectedPath,
  onSelectPath,
  selectedValue,
}) => {
  const { showToast } = useToast();
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [contextMenu, setContextMenu] = useState(null);

  // Get the actual value from provenance-wrapped object
  const actualValue = typeof nodeData === "object" && nodeData?._actual_value !== undefined 
    ? nodeData._actual_value 
    : nodeData;

  const keyName = Object.keys(actualValue || {}).length === 1 
    ? Object.keys(actualValue)[0]
    : null;

  const isExpanded = expandedPaths.has(path);
  const isArray = Array.isArray(actualValue);
  const isObject = typeof actualValue === "object" && actualValue !== null && !isArray;
  const hasChildren = isArray ? actualValue.length > 0 : (isObject ? Object.keys(actualValue).length > 0 : false);

  const handleToggleExpand = (e) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedPaths);
    if (isExpanded) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  const handleNodeClick = (e) => {
    e.stopPropagation();
    onSelectPath?.(path);
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectPath?.(path);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = () => {
    if (!newName.trim()) {
      showToast("Name cannot be empty", "error");
      return;
    }

    const oldPath = path.split(".").pop();
    if (newName === oldPath) {
      setIsRenaming(false);
      return;
    }

    // Use onStructuralChange to rename
    if (onStructuralChange) {
      onStructuralChange("rename", path, newName);
      setIsRenaming(false);
      showToast(`Renamed to "${newName}"`, "success");
    }
  };

  const handleRenameCancel = () => {
    setIsRenaming(false);
    setNewName("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      handleRenameCancel();
    }
  };

  // Build context menu items
  const menuItems = [];

  if (isEditable && configType === "COMPONENT") {
    menuItems.push({
      label: "Rename",
      icon: PencilIcon,
      onClick: () => {
        setIsRenaming(true);
        setNewName(keyName || "");
        setContextMenu(null);
      },
    });

    menuItems.push({
      label: "Remove",
      icon: TrashIcon,
      onClick: () => {
        if (window.confirm(`Are you sure you want to remove "${keyName || '(unnamed)'}" and all its contents?`)) {
          onStructuralChange("remove", path);
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
          const cleanPath = path.startsWith("root.") ? path.substring(5) : path;
          const textArea = document.createElement("textarea");
          textArea.value = cleanPath;
          document.body.appendChild(textArea);
          const successful = document.execCommand("copy");
          if (successful) {
            showToast("Path copied to clipboard", "success");
          }
          document.body.removeChild(textArea);
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
          const textArea = document.createElement("textarea");
          textArea.value = jsonString;
          document.body.appendChild(textArea);
          const successful = document.execCommand("copy");
          if (successful) {
            showToast("JSON copied to clipboard", "success");
          }
          document.body.removeChild(textArea);
        } catch (err) {
          console.error("Failed to copy JSON:", err);
          showToast("Failed to copy JSON to clipboard", "error");
        }
      },
    }
  );

  if (isEditable && configType === "COMPONENT" && isObject && !isArray) {
    menuItems.push({
      label: "Add Property",
      icon: PlusIcon,
      onClick: () => {
        const propertyName = prompt("Enter property name:");
        if (propertyName) {
          onStructuralChange("add", path, propertyName, {});
        }
      },
    });
  }

  const renderNode = () => {
    if (isArray) {
      return (
        <div>
          <div
            onClick={handleNodeClick}
            onContextMenu={handleContextMenu}
            className={`py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
              selectedPath === path ? "bg-blue-100 dark:bg-blue-900" : ""
            }`}
          >
            {hasChildren && (
              <button onClick={handleToggleExpand} className="p-0 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-4" />}
            <span className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">Array</span>
              {hasChildren && <span className="ml-1 text-xs text-gray-500">({actualValue.length})</span>}
            </span>
          </div>

          {isExpanded &&
            actualValue.map((item, index) => (
              <StructuralTreeNode
                key={`${path}[${index}]`}
                nodeData={item}
                path={`${path}[${index}]`}
                level={level + 1}
                isEditable={isEditable}
                configType={configType}
                onValueChange={onValueChange}
                onPropertyAdd={onPropertyAdd}
                onPropertyDelete={onPropertyDelete}
                onStructuralChange={onStructuralChange}
                expandedPaths={expandedPaths}
                setExpandedPaths={setExpandedPaths}
                selectedPath={selectedPath}
                onSelectPath={onSelectPath}
                selectedValue={selectedValue}
              />
            ))}
        </div>
      );
    }

    if (isObject) {
      return (
        <div>
          <div
            onClick={handleNodeClick}
            onContextMenu={handleContextMenu}
            className={`py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
              selectedPath === path ? "bg-blue-100 dark:bg-blue-900" : ""
            }`}
          >
            {hasChildren && (
              <button onClick={handleToggleExpand} className="p-0 hover:bg-gray-200 dark:hover:bg-gray-600 rounded">
                {isExpanded ? (
                  <ChevronDownIcon className="w-4 h-4" />
                ) : (
                  <ChevronRightIcon className="w-4 h-4" />
                )}
              </button>
            )}
            {!hasChildren && <div className="w-4" />}

            {isRenaming ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-1 py-0 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                  placeholder="Enter object name"
                />
                <button
                  onClick={handleRename}
                  className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 focus:outline-none"
                  title="Apply"
                >
                  <CheckIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleRenameCancel}
                  className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 focus:outline-none"
                  title="Cancel"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <span className="font-medium text-gray-700 dark:text-gray-300 truncate">
                {keyName || "(unnamed)"}
                {hasChildren && (
                  <span className="ml-1 text-xs text-gray-500">({Object.keys(actualValue).length})</span>
                )}
              </span>
            )}
          </div>

          {isExpanded &&
            Object.entries(actualValue).map(([key, value]) => (
              <StructuralTreeNode
                key={`${path}.${key}`}
                nodeData={value}
                path={`${path}.${key}`}
                level={level + 1}
                isEditable={isEditable}
                configType={configType}
                onValueChange={onValueChange}
                onPropertyAdd={onPropertyAdd}
                onPropertyDelete={onPropertyDelete}
                onStructuralChange={onStructuralChange}
                expandedPaths={expandedPaths}
                setExpandedPaths={setExpandedPaths}
                selectedPath={selectedPath}
                onSelectPath={onSelectPath}
                selectedValue={selectedValue}
              />
            ))}
        </div>
      );
    }

    // Scalar value
    return (
      <div
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        className={`py-1 px-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${
          selectedPath === path ? "bg-blue-100 dark:bg-blue-900" : ""
        }`}
      >
        <div className="w-4" />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {typeof actualValue === "string" ? `"${actualValue}"` : String(actualValue)}
        </span>
      </div>
    );
  };

  return (
    <div style={{ marginLeft: `${level * 0.5}rem` }}>
      {renderNode()}
      <ContextMenu
        x={contextMenu?.x}
        y={contextMenu?.y}
        items={menuItems}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
};

export default StructuralTreeNode;
