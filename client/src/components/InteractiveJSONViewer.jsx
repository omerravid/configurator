import React, { useState, useEffect } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  PencilIcon,
  ClipboardIcon,
  MapIcon,
  DocumentDuplicateIcon,
} from "@heroicons/react/24/outline";
import ContextMenu from "./ContextMenu";

// Helper function to safely extract actual values from provenance-wrapped objects
const extractActualValue = (val) => {
  if (
    val &&
    typeof val === "object" &&
    val.hasOwnProperty("value") &&
    val.hasOwnProperty("source")
  ) {
    return val.value;
  }
  return val;
};

// Helper function to safely convert any value to string for rendering
const safeToString = (val) => {
  const actualVal = extractActualValue(val);
  if (actualVal === null || actualVal === undefined) {
    return "";
  }
  return String(actualVal);
};

const ProvenanceTooltip = ({ source, isVisible, position, path }) => {
  if (!isVisible || !source) return null;

  // Safely extract values from source object
  const sourceType = safeToString(source.type);
  const sourceName = safeToString(source.name);
  const sourceId = safeToString(source.id);

  const getTypeColor = (type) => {
    switch (type) {
      case "PRODUCT":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "INSTANCE":
        return "text-green-600 bg-green-50 border-green-200";
      case "USER":
        return "text-purple-600 bg-purple-50 border-purple-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getInheritanceLabel = (type) => {
    switch (type) {
      case "PRODUCT":
        return "Defined in Product";
      case "INSTANCE":
        return "Overridden in Instance";
      case "USER":
        return "Overridden in User Config";
      default:
        return "Defined in";
    }
  };

  return (
    <div
      className="fixed z-50 px-3 py-2 bg-white border-2 rounded-lg shadow-lg max-w-xs"
      style={{
        left: Math.min(position.x + 10, window.innerWidth - 250),
        top: Math.max(position.y - 10, 10),
      }}
    >
      <div className="text-xs font-medium text-gray-700 mb-1">
        {getInheritanceLabel(sourceType)}:
      </div>
      <div
        className={`text-sm font-medium px-2 py-1 rounded border ${getTypeColor(sourceType)}`}
      >
        {sourceType}: {sourceName}
      </div>
      {path && <div className="text-xs text-gray-500 mt-1">Path: {path}</div>}
      <div className="text-xs text-gray-500 mt-1">ID: {sourceId}</div>
    </div>
  );
};

const TreeNode = ({
  keyName,
  value,
  path = "",
  depth = 0,
  onHover,
  onHoverEnd,
  isRoot = false,
  isEditable = false,
  onValueChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const [editValue, setEditValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const currentPath = path ? `${path}.${keyName}` : keyName;

  // Safely extract actual value and source from provenance-wrapped values
  const getActualValueAndSource = (val) => {
    if (
      val &&
      typeof val === "object" &&
      val.hasOwnProperty("value") &&
      val.hasOwnProperty("source")
    ) {
      return {
        actualValue: val.value,
        source: val.source,
      };
    }
    return {
      actualValue: val,
      source: null,
    };
  };

  const { actualValue, source } = getActualValueAndSource(value);

  const handleMouseEnter = (e) => {
    if (source) {
      onHover?.(currentPath, source, currentPath);
    }
  };

  const handleMouseLeave = () => {
    onHoverEnd?.();
  };

  const handleEditStart = () => {
    setEditValue(safeToString(actualValue));
    setIsEditing(true);
  };

  const handleEditSave = () => {
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

    onValueChange?.(currentPath, newValue);
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue(safeToString(actualValue));
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const fullPath = isRoot ? "" : currentPath;

    const menuItems = [
      {
        label: "Copy Value",
        icon: ClipboardIcon,
        onClick: () => copyToClipboard(JSON.stringify(actualValue)),
      },
      {
        label: "Copy Path",
        icon: MapIcon,
        onClick: () => copyToClipboard(fullPath),
        disabled: isRoot,
      },
      {
        label: "Copy Full Object",
        icon: DocumentDuplicateIcon,
        onClick: () => copyToClipboard(JSON.stringify(actualValue, null, 2)),
      },
    ];

    if (isEditable && isPrimitive) {
      menuItems.unshift({
        label: "Edit Value",
        icon: PencilIcon,
        onClick: handleEditStart,
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
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
  };

  const isObject =
    actualValue &&
    typeof actualValue === "object" &&
    !Array.isArray(actualValue);
  const isArray = Array.isArray(actualValue);
  const isPrimitive = !isObject && !isArray;

  const renderPrimitiveValue = () => {
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

  const renderEditableValue = () => {
    if (isEditing) {
      return (
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEditSave();
              if (e.key === "Escape") handleEditCancel();
            }}
            autoFocus
          />
          <button
            onClick={handleEditSave}
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
      );
    }

    return (
      <div className="flex items-center space-x-2">
        {renderPrimitiveValue()}
        {isEditable && (
          <button
            onClick={handleEditStart}
            className="opacity-0 group-hover:opacity-100 px-1 py-0.5 text-xs text-gray-500 hover:text-gray-700"
          >
            ✏️
          </button>
        )}
      </div>
    );
  };

  const renderArrayItems = () => {
    if (!isArray) return null;

    return actualValue.map((item, index) => (
      <TreeNode
        key={index}
        keyName={index.toString()}
        value={item}
        path={currentPath}
        depth={depth + 1}
        onHover={onHover}
        onHoverEnd={onHoverEnd}
        isEditable={isEditable}
        onValueChange={onValueChange}
      />
    ));
  };

  const renderObjectProperties = () => {
    if (!isObject) return null;

    return Object.entries(actualValue).map(([key, val]) => (
      <TreeNode
        key={key}
        keyName={key}
        value={val}
        path={currentPath}
        depth={depth + 1}
        onHover={onHover}
        onHoverEnd={onHoverEnd}
        isEditable={isEditable}
        onValueChange={onValueChange}
      />
    ));
  };

  // Visual indicator for inherited vs overridden values
  const getInheritanceIndicator = () => {
    if (!source) return null;

    const sourceType = safeToString(source.type);
    let color = "text-gray-400";
    let title = "Inherited";

    switch (sourceType) {
      case "PRODUCT":
        color = "text-blue-400";
        title = "From Product";
        break;
      case "INSTANCE":
        color = "text-green-400";
        title = "From Instance";
        break;
      case "USER":
        color = "text-purple-400";
        title = "From User Config";
        break;
    }

    return (
      <div
        className={`w-2 h-2 rounded-full ${color.replace("text-", "bg-")} ml-1`}
        title={title}
      />
    );
  };

  return (
    <div className="group">
      <div
        className={`flex items-center py-1 hover:bg-gray-50 rounded ${source ? "cursor-help" : ""}`}
        style={{ paddingLeft: `${depth * 20}px` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Expand/Collapse button */}
        {(isObject || isArray) && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 p-1 hover:bg-gray-200 rounded mr-1"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 text-gray-600" />
            )}
          </button>
        )}

        {!isObject && !isArray && <div className="w-6 mr-1" />}

        {/* Key name */}
        {!isRoot && (
          <span className="font-medium text-gray-700 mr-2">"{keyName}":</span>
        )}

        {/* Value */}
        {isPrimitive ? (
          renderEditableValue()
        ) : isArray ? (
          <span className="text-gray-600">[{actualValue.length} items]</span>
        ) : (
          <span className="text-gray-600">
            {`{${Object.keys(actualValue).length} properties}`}
          </span>
        )}

        {/* Inheritance indicator */}
        {getInheritanceIndicator()}

        {/* Provenance indicator */}
        {source && (
          <InformationCircleIcon className="w-4 h-4 text-gray-400 ml-1" />
        )}
      </div>

      {/* Expanded children */}
      {isExpanded && (isObject || isArray) && (
        <div>{isArray ? renderArrayItems() : renderObjectProperties()}</div>
      )}
    </div>
  );
};

const InteractiveJSONViewer = ({
  data,
  metadata,
  title,
  className = "",
  isEditable = false,
  onDataChange,
}) => {
  const [hoveredSource, setHoveredSource] = useState(null);
  const [hoveredPath, setHoveredPath] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [showInheritanceChain, setShowInheritanceChain] = useState(false);

  const handleHover = (path, source, fullPath) => {
    setHoveredSource(source);
    setHoveredPath(fullPath);
    setShowTooltip(true);
  };

  const handleHoverEnd = () => {
    setShowTooltip(false);
    setHoveredSource(null);
    setHoveredPath(null);
  };

  const handleMouseMove = (e) => {
    setTooltipPosition({ x: e.clientX, y: e.clientY });
  };

  const handleValueChange = (path, newValue) => {
    onDataChange?.(path, newValue);
  };

  if (!data) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        No data to display
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} onMouseMove={handleMouseMove}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        {title && (
          <h3 className="text-lg font-medium text-gray-900">{title}</h3>
        )}

        {metadata && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowInheritanceChain(!showInheritanceChain)}
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              {showInheritanceChain ? "Hide" : "Show"} Inheritance Chain
            </button>
          </div>
        )}
      </div>

      {/* Inheritance Legend */}
      <div className="mb-3 flex items-center space-x-4 text-xs text-gray-600">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-blue-400"></div>
          <span>Product</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span>Instance</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-purple-400"></div>
          <span>User</span>
        </div>
      </div>

      {/* Inheritance Chain */}
      {showInheritanceChain && metadata && metadata.chain && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Inheritance Chain ({metadata.chainLength} levels)
          </h4>
          <div className="flex items-center space-x-2 text-sm">
            {metadata.chain.map((level, index) => (
              <React.Fragment key={safeToString(level.id)}>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    safeToString(level.type) === "PRODUCT"
                      ? "bg-blue-100 text-blue-800"
                      : safeToString(level.type) === "INSTANCE"
                        ? "bg-green-100 text-green-800"
                        : "bg-purple-100 text-purple-800"
                  }`}
                >
                  {safeToString(level.name)}
                </span>
                {index < metadata.chain.length - 1 && (
                  <span className="text-gray-400">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* JSON Tree */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-auto">
        <TreeNode
          keyName="root"
          value={data}
          onHover={handleHover}
          onHoverEnd={handleHoverEnd}
          isRoot={true}
          isEditable={isEditable}
          onValueChange={handleValueChange}
        />
      </div>

      {/* Tooltip */}
      <ProvenanceTooltip
        source={hoveredSource}
        isVisible={showTooltip}
        position={tooltipPosition}
        path={hoveredPath}
      />

      {/* Help text */}
      <div className="mt-2 text-xs text-gray-500">
        💡 Hover over values to see their source configuration • Colored dots
        indicate inheritance level
        {isEditable && " • Click ✏️ to edit values"}
      </div>
    </div>
  );
};

export default InteractiveJSONViewer;
