import React, { useState } from "react";
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
  ClipboardIcon,
  MapIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";
import ContextMenu from "./ContextMenu";

const ScalarPropertiesPanel = ({
  selectedPath,
  selectedValue,
  onValueChange,
  onPropertyAdd,
  onPropertyDelete,
  isEditable = false,
  onHover,
  onHoverEnd,
  onGetActiveTooltipPath,
}) => {
  const { showToast } = useToast();
  const [editingProperty, setEditingProperty] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  // Extract actual value and source from provenance wrapper
  const getActualValueAndSource = (val) => {
    let currentVal = val;
    let source = null;

    while (
      currentVal &&
      typeof currentVal === "object" &&
      currentVal.hasOwnProperty("value") &&
      currentVal.hasOwnProperty("source") &&
      Object.keys(currentVal).length === 2
    ) {
      source = currentVal.source;
      currentVal = currentVal.value;
    }

    return { actualValue: currentVal, source };
  };

  const safeToString = (val) => {
    const { actualValue } = getActualValueAndSource(val);
    if (actualValue === null || actualValue === undefined) {
      return "";
    }
    return String(actualValue);
  };

  const getScalarProperties = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }

    return Object.entries(value).filter(([key, val]) => {
      const { actualValue } = getActualValueAndSource(val);
      return (
        actualValue === null ||
        actualValue === undefined ||
        typeof actualValue === "string" ||
        typeof actualValue === "number" ||
        typeof actualValue === "boolean"
      );
    });
  };

  const scalarProperties = getScalarProperties(selectedValue);

  const handleEditStart = (propertyName, value) => {
    setEditingProperty(propertyName);
    setEditValue(safeToString(value));
  };

  const handleEditSave = (propertyName) => {
    let newValue = editValue;

    // Try to parse as JSON for numbers, booleans, etc.
    try {
      if (editValue === "true" || editValue === "false") {
        newValue = editValue === "true";
      } else if (!isNaN(editValue) && editValue !== "" && editValue !== null) {
        newValue = Number(editValue);
      } else if (editValue === "null") {
        newValue = null;
      }
    } catch (e) {
      // Keep as string if parsing fails
    }

    // Create the full path for the property
    let propertyPath;
    if (selectedPath === "root") {
      propertyPath = `root.${propertyName}`;
    } else {
      propertyPath = `${selectedPath}.${propertyName}`;
    }

    console.log("ScalarPanel editing:", { propertyName, newValue, selectedPath, propertyPath });
    onValueChange?.(propertyPath, newValue);
    setEditingProperty(null);
  };

  const handleEditCancel = () => {
    setEditingProperty(null);
    setEditValue("");
  };

  const handleAddProperty = () => {
    if (!newPropertyName.trim()) {
      showToast("Property name cannot be empty", "error");
      return;
    }

    if (selectedValue && selectedValue.hasOwnProperty(newPropertyName)) {
      showToast("Property already exists", "error");
      return;
    }

    let parsedValue = newPropertyValue;
    try {
      if (newPropertyValue === "true" || newPropertyValue === "false") {
        parsedValue = newPropertyValue === "true";
      } else if (!isNaN(newPropertyValue) && newPropertyValue !== "" && newPropertyValue !== null) {
        parsedValue = Number(newPropertyValue);
      } else if (newPropertyValue === "null") {
        parsedValue = null;
      }
    } catch (e) {
      // Keep as string if parsing fails
    }

    onPropertyAdd?.(selectedPath, newPropertyName, parsedValue);
    setNewPropertyName("");
    setNewPropertyValue("");
    setShowAddProperty(false);
  };

  const handleDeleteProperty = (propertyName) => {
    onPropertyDelete?.(selectedPath, propertyName);
  };

  const copyToClipboard = async (text, label = "Value") => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast(`${label} copied to clipboard!`);
      } else {
        // Fallback for iframes and older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (successful) {
          showToast(`${label} copied to clipboard!`);
        } else {
          showToast("Failed to copy to clipboard", "error");
        }
      }
    } catch (err) {
      showToast("Failed to copy to clipboard", "error");
    }
  };

  const handleInfoClick = (propertyName, source) => {
    const propertyPath = selectedPath ? `${selectedPath}.${propertyName}` : propertyName;
    if (source) {
      if (onGetActiveTooltipPath && onGetActiveTooltipPath() === propertyPath) {
        onHoverEnd?.();
      } else {
        const event = { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 };
        onHover?.(propertyPath, source, propertyPath, event);
      }
    }
  };

  const handlePropertyContextMenu = (e, propertyName, value) => {
    e.preventDefault();
    const { actualValue } = getActualValueAndSource(value);

    // Create path for this property
    const propertyPath = selectedPath === "root"
      ? propertyName
      : selectedPath.replace(/^root\./, "")
        ? `${selectedPath.replace(/^root\./, "")}.${propertyName}`
        : propertyName;

    const menuItems = [
      {
        label: "Copy Value",
        icon: ClipboardIcon,
        onClick: () => copyToClipboard(safeToString(actualValue), "Value"),
      },
      {
        label: "Copy Path",
        icon: MapIcon,
        onClick: () => copyToClipboard(propertyPath, "Path"),
      },
      {
        label: "Copy as JSON",
        icon: DocumentDuplicateIcon,
        onClick: () => copyToClipboard(JSON.stringify(actualValue, null, 2), "JSON"),
      },
    ];

    if (isEditable) {
      menuItems.unshift({
        label: "Edit Value",
        icon: PencilIcon,
        onClick: () => handleEditStart(propertyName, value),
      });

      menuItems.push({
        label: "Delete Property",
        icon: TrashIcon,
        onClick: () => handleDeleteProperty(propertyName),
      });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: menuItems,
    });
  };

  const renderPropertyValue = (value) => {
    const { actualValue } = getActualValueAndSource(value);

    if (actualValue === null) {
      return <span className="text-gray-400 italic">null</span>;
    }

    if (typeof actualValue === "string") {
      return <span className="text-green-600">"{actualValue}"</span>;
    }

    if (typeof actualValue === "number") {
      return <span className="text-blue-600">{String(actualValue)}</span>;
    }

    if (typeof actualValue === "boolean") {
      return <span className="text-purple-600">{String(actualValue)}</span>;
    }

    return <span className="text-gray-600">{safeToString(actualValue)}</span>;
  };

  if (!selectedPath) {
    return (
      <div className="p-4 text-center text-gray-500">
        <div className="text-lg mb-2">Properties Panel</div>
        <div className="text-sm">Select an item from the structure tree to view its scalar properties</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Properties</h3>
        {isEditable && (
          <button
            onClick={() => setShowAddProperty(true)}
            className="flex items-center space-x-1 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Property</span>
          </button>
        )}
      </div>

      <div className="text-sm text-gray-600 mb-4">
        Path: <span className="font-mono bg-gray-100 px-1 rounded">{selectedPath}</span>
        <button
          onClick={() => copyToClipboard(selectedPath, "Path")}
          className="ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
          title="Copy path"
        >
          <ClipboardIcon className="w-3 h-3" />
        </button>
      </div>

      {/* Add Property Form */}
      {showAddProperty && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded">
          <h4 className="text-sm font-medium mb-2">Add New Property</h4>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Property name"
              value={newPropertyName}
              onChange={(e) => setNewPropertyName(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Property value"
              value={newPropertyValue}
              onChange={(e) => setNewPropertyValue(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex space-x-2">
              <button
                onClick={handleAddProperty}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddProperty(false);
                  setNewPropertyName("");
                  setNewPropertyValue("");
                }}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Properties List */}
      <div className="space-y-2">
        {scalarProperties.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No scalar properties to display
          </div>
        ) : (
          scalarProperties.map(([propertyName, value]) => {
            const { source } = getActualValueAndSource(value);
            const isEditing = editingProperty === propertyName;

            return (
              <div
                key={propertyName}
                className="group flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50 cursor-context-menu"
                onContextMenu={(e) => handlePropertyContextMenu(e, propertyName, value)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-700">{propertyName}:</span>
                    {isEditing ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleEditSave(propertyName);
                            if (e.key === "Escape") handleEditCancel();
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditSave(propertyName)}
                          className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {renderPropertyValue(value)}
                        {source && (
                          <button
                            onClick={() => handleInfoClick(propertyName, source)}
                            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                            title="Show source information"
                          >
                            <InformationCircleIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!isEditing && (
                  <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyToClipboard(safeToString(value), "Value")}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                      title="Copy value"
                    >
                      <ClipboardIcon className="w-3 h-3" />
                    </button>
                    {isEditable && (
                      <>
                        <button
                          onClick={() => handleEditStart(propertyName, value)}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                          title="Edit value"
                        >
                          <PencilIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteProperty(propertyName)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                          title="Delete property"
                        >
                          <TrashIcon className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

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

export default ScalarPropertiesPanel;
