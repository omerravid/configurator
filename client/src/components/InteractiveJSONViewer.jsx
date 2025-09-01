import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  PencilIcon,
  ClipboardIcon,
  MapIcon,
  DocumentDuplicateIcon,
  ViewColumnsIcon,
  RectangleStackIcon,
} from "@heroicons/react/24/outline";
import ContextMenu from "./ContextMenu";
import StructuralTreeNode from "./StructuralTreeNode";
import ScalarPropertiesPanel from "./ScalarPropertiesPanel";
import { useToast } from "../context/ToastContext";
import VrmlPreview from "./VrmlPreview";
import RuleDefinitionDialog from "./RuleDefinitionDialog";

// Helper function to safely extract actual values from provenance-wrapped objects
const extractActualValue = (val) => {
  // Handle nested provenance wrappers
  let currentVal = val;

  // Keep unwrapping until we get to the actual value
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
  const createdBy = safeToString(source.createdBy);
  const createdAt = source.createdAt;
  const updatedAt = source.updatedAt;

  const getTypeColor = (type) => {
    switch (type) {
      case "PRODUCT":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "COMPONENT":
        return "text-teal-600 bg-teal-50 border-teal-200";
      case "VERSION":
        return "text-amber-600 bg-amber-50 border-amber-200";
      case "INSTANCE":
        return "text-green-600 bg-green-50 border-green-200";
      case "USER":
        return "text-purple-600 bg-purple-50 border-purple-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getInheritanceLabel = (type, source) => {
    switch (type) {
      case "PRODUCT":
        return "Defined in Product";
      case "COMPONENT":
        return "Defined in Component";
      case "VERSION":
        // Show component name with version in parentheses for better context
        if (source.parentName && source.name) {
          return `Defined in ${source.parentName} (${source.name})`;
        } else {
          return "Defined in Version";
        }
      case "INSTANCE":
        return "Overridden in Instance";
      case "USER":
        return "Overridden in User Config";
      default:
        return "Defined in";
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return timestamp;
    }
  };

  return (
    <div
      className="fixed z-50 px-3 py-2 bg-white border-2 rounded-lg shadow-lg max-w-sm"
      style={{
        left: Math.min(position.x + 10, window.innerWidth - 280),
        top: Math.max(position.y - 10, 10),
      }}
    >
      <div className="text-xs font-medium text-gray-700 mb-1">
        {getInheritanceLabel(sourceType, source)}:
      </div>
      <div
        className={`text-sm font-medium px-2 py-1 rounded border ${getTypeColor(sourceType)}`}
      >
        {sourceType}: {sourceName}
      </div>
      {path && <div className="text-xs text-gray-500 mt-1">Path: {path}</div>}
      <div className="text-xs text-gray-500 mt-1">ID: {sourceId}</div>

      {/* User and timestamp information */}
      <div className="border-t border-gray-200 mt-2 pt-2">
        {createdBy && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Created by:</span> {createdBy}
          </div>
        )}
        {createdAt && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Created:</span> {formatTimestamp(createdAt)}
          </div>
        )}
        {updatedAt && updatedAt !== createdAt && (
          <div className="text-xs text-gray-600">
            <span className="font-medium">Updated:</span> {formatTimestamp(updatedAt)}
          </div>
        )}
      </div>
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
  expandedPaths = new Set(),
  onExpandToggle = () => {},
  onGetActiveTooltipPath,
}) => {
  const { showToast } = useToast();
  const [editValue, setEditValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [validationError, setValidationError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const validateTimeoutRef = React.useRef(null);
  const [hdrPreview, setHdrPreview] = useState(null);
  const [hdrLoading, setHdrLoading] = useState(false);
  const [hdrVisible, setHdrVisible] = useState(false);
  const [vrmlVisible, setVrmlVisible] = useState(false);

  // Reset inline file preview when node identity changes
  React.useEffect(() => {
    setHdrPreview(null);
    setHdrVisible(false);
    setHdrLoading(false);
    setVrmlVisible(false);
  }, [path, keyName, value]);

  const currentPath = path ? `${path}.${keyName}` : keyName;

  // Use global expand state, with default expansion for shallow depths
  const isExpanded = expandedPaths.has(currentPath) || (expandedPaths.size === 0 && depth < 2);

  const toggleExpanded = () => {
    const newExpandedState = !isExpanded;
    onExpandToggle(currentPath, newExpandedState);
  };

  // Safely extract actual value and source from provenance-wrapped values
  const getActualValueAndSource = (val) => {
    // Handle nested provenance wrappers
    let currentVal = val;
    let source = null;

    // Keep unwrapping until we get to the actual value
    while (
      currentVal &&
      typeof currentVal === "object" &&
      currentVal.hasOwnProperty("value") &&
      currentVal.hasOwnProperty("source") &&
      Object.keys(currentVal).length === 2
    ) {
      source = currentVal.source; // Keep the deepest source
      currentVal = currentVal.value;
    }

    return {
      actualValue: currentVal,
      source: source,
    };
  };

  const { actualValue, source } = getActualValueAndSource(value);

  const handleInfoClick = (e) => {
    e.stopPropagation();
    if (source) {
      // Toggle tooltip - if same path is clicked, close it, otherwise show new one
      if (onGetActiveTooltipPath && onGetActiveTooltipPath() === currentPath) {
        onHoverEnd?.();
      } else {
        onHover?.(currentPath, source, currentPath, e);
      }
    }
  };

  const validateValue = async (value) => {
    if (!selectedConfig?.id) return true;

    // Clean the path - remove root prefix
    const cleanPath = currentPath.startsWith("root.") ? currentPath.substring(5) : currentPath;

    try {
      setIsValidating(true);
      const response = await fetch('/api/rules/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          configurationId: selectedConfig.id,
          propertyPath: cleanPath,
          value: value
        })
      });

      const result = await response.json();

      if (!response.ok) {
        setValidationError(result.error || 'Validation failed');
        return false;
      }

      if (!result.isValid) {
        setValidationError(result.errors.join(', '));
        return false;
      }

      setValidationError("");
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      setValidationError('Validation service unavailable');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleEditStart = () => {
    setEditValue(safeToString(actualValue));
    setIsEditing(true);
    setValidationError("");
  };

  const handleEditSave = async () => {
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

    // Validate the value before saving
    const isValid = await validateValue(newValue);
    if (!isValid) {
      return; // Don't save if validation fails
    }

    onValueChange?.(currentPath, newValue);
    setIsEditing(false);
    setValidationError("");
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditValue(safeToString(actualValue));
  };

  const handleReset = () => {
    if (!source || isRoot) return;

    onValueChange?.(currentPath, null); // null removes the override
    console.log("Reset property:", currentPath);
  };

  const handleRulesClick = async () => {
    if (!selectedConfig?.id) {
      console.warn("No configuration ID available for rules");
      return;
    }

    // Clean the path - remove root prefix and convert to dot notation
    const cleanPath = currentPath.startsWith("root.") ? currentPath.substring(5) : currentPath;

    try {
      // Fetch existing rules for this property
      const response = await fetch(`/api/rules/configuration/${selectedConfig.id}/path/${encodeURIComponent(cleanPath)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const existingRules = response.ok ? await response.json() : [];

      setRulesDialog({
        isOpen: true,
        configurationId: selectedConfig.id,
        propertyPath: cleanPath,
        existingRules
      });
    } catch (error) {
      console.error("Failed to fetch existing rules:", error);
      setRulesDialog({
        isOpen: true,
        configurationId: selectedConfig.id,
        propertyPath: cleanPath,
        existingRules: []
      });
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    const fullPath = isRoot ? "" : currentPath;

    const menuItems = [
      {
        label: "Copy Value",
        icon: ClipboardIcon,
        onClick: () => copyToClipboard(JSON.stringify(actualValue), "Value"),
      },
      {
        label: "Copy Path",
        icon: MapIcon,
        onClick: () => {
          // Strip "root." prefix from path
          const cleanPath = fullPath.startsWith("root.")
            ? fullPath.substring(5)
            : fullPath;
          copyToClipboard(cleanPath, "Path");
        },
        disabled: isRoot,
      },
      {
        label: "Copy as JSON",
        icon: DocumentDuplicateIcon,
        onClick: () =>
          copyToClipboard(JSON.stringify(actualValue, null, 2), "JSON"),
      },
    ];

    if (isEditable && isPrimitive) {
      menuItems.unshift({
        label: "Edit Value",
        icon: PencilIcon,
        onClick: handleEditStart,
      });

      // Add reset option if this property has provenance (indicating inheritance)
      if (source && !isRoot) {
        menuItems.push({
          label: "Reset to Inherited",
          icon: () => <span className="text-orange-500 text-sm font-bold">↺</span>,
          onClick: handleReset,
        });
      }
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: menuItems,
    });
  };

  const copyToClipboard = async (text, label = "Value") => {
    // Always use fallback since Clipboard API is blocked in iframes
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      textArea.setSelectionRange(0, 99999); // For mobile
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        showToast(`${label} copied to clipboard!`);
      } else {
        showToast("Failed to copy to clipboard", "error");
      }
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      showToast("Failed to copy to clipboard", "error");
    }
  };

  // Check if the original value is a provenance wrapper that shouldn't be expanded as an object
  // Provenance wrappers have the structure {value: actualValue, source: sourceInfo}
  // These should be treated as leaf nodes, not as expandable objects
  const isProvenanceWrapper =
    value &&
    typeof value === "object" &&
    value.hasOwnProperty("value") &&
    value.hasOwnProperty("source") &&
    Object.keys(value).length === 2; // Only has 'value' and 'source' properties

  // Check if this is a binary file object
  const isBinaryFile =
    actualValue &&
    typeof actualValue === "object" &&
    actualValue._type === "file" &&
    actualValue._link;

  const isObject =
    actualValue &&
    typeof actualValue === "object" &&
    !Array.isArray(actualValue) &&
    !isProvenanceWrapper &&
    !isBinaryFile; // Treat binary files as non-objects
  const isArray = Array.isArray(actualValue);
  const isPrimitive = !isObject && !isArray;

  const renderPrimitiveValue = () => {
    // Handle binary file objects
    if (isBinaryFile) {
      const metadata = actualValue._metadata || {};
      const isHdr = (metadata.originalName || '').toLowerCase().endsWith('.hdr');
      const isTxt = (metadata.originalName || '').toLowerCase().endsWith('.txt');
      const isVrml = /\.(vrml|wrl)$/i.test(metadata.originalName || '');
      const canPreview = isHdr || isTxt || isVrml;

      const handleTogglePreview = async () => {
        const storageKey = metadata.storageKey;
        if (!storageKey) return setHdrVisible(v => !v);
        if (!hdrVisible && hdrPreview == null) {
          setHdrLoading(true);
          try {
            const resp = await fetch(`/api/files/${storageKey}`, {
              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const text = await resp.text();
            if (isTxt) {
              setHdrPreview(text);
            } else if (isHdr) {
              try {
                const json = JSON.parse(text);
                setHdrPreview(json);
              } catch (e) {
                setHdrPreview({ _previewError: 'Not valid JSON', _raw: text.slice(0, 2000) });
              }
            }
          } catch (e) {
            setHdrPreview(isTxt ? 'Failed to load preview' : { _previewError: 'Failed to load preview' });
          } finally {
            setHdrLoading(false);
            setHdrVisible(true);
          }
        } else {
          setHdrVisible(v => !v);
        }
      };

      return (
        <div className="inline-flex flex-col space-y-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <a
              href={actualValue._link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 font-medium text-sm underline"
              title={`Download ${metadata.originalName} (${metadata.mimeType})`}
            >
              {metadata.originalName || 'Download File'}
            </a>
            {isVrml && (
              <button
                onClick={(e) => { e.stopPropagation(); setVrmlVisible(v => !v); }}
                className="text-xs px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                title="Toggle 3D preview"
              >
                {vrmlVisible ? 'Hide 3D' : '3D'}
              </button>
            )}
            {(isHdr || isTxt) && (
              <button
                onClick={(e) => { e.stopPropagation(); handleTogglePreview(); }}
                className="text-xs px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 text-gray-700"
                title={isTxt ? 'Toggle text preview' : 'Toggle JSON preview'}
              >
                {hdrVisible ? 'Hide Preview' : (hdrLoading ? 'Loading…' : 'Preview')}
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {metadata.size ? `${Math.round(metadata.size / 1024)}KB` : ''}
            {metadata.mimeType && metadata.size ? ' • ' : ''}
            {metadata.mimeType ? metadata.mimeType.split('/')[1]?.toUpperCase() : ''}
          </div>
          {(isHdr || isTxt) && hdrVisible && (
            <div className="mt-1 max-h-64 overflow-auto bg-white border border-gray-200 rounded p-2">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap">
                {hdrPreview == null ? '' : (isTxt ? String(hdrPreview) : JSON.stringify(hdrPreview, null, 2))}
              </pre>
            </div>
          )}
          {isVrml && vrmlVisible && (
            <div className="mt-2">
              <VrmlPreview storageKey={metadata.storageKey} authToken={localStorage.getItem('token')} />
            </div>
          )}
        </div>
      );
    }

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
        <div className="flex flex-col space-y-1">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={editValue}
              onChange={async (e) => {
                const newValue = e.target.value;
                setEditValue(newValue);

                // Debounced validation - only validate if user pauses typing
                if (validateTimeoutRef.current) {
                  clearTimeout(validateTimeoutRef.current);
                }
                validateTimeoutRef.current = setTimeout(async () => {
                  let parsedValue = newValue;
                  try {
                    if (newValue === "true" || newValue === "false") {
                      parsedValue = newValue === "true";
                    } else if (!isNaN(newValue) && newValue !== "" && newValue !== null) {
                      parsedValue = Number(newValue);
                    } else if (newValue === "null") {
                      parsedValue = null;
                    }
                  } catch (e) {
                    // Keep as string if parsing fails
                  }
                  await validateValue(parsedValue);
                }, 500); // Wait 500ms after user stops typing
              }}
              className={`px-2 py-1 border rounded text-sm focus:outline-none focus:ring-2 ${
                validationError
                  ? 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEditSave();
                if (e.key === "Escape") handleEditCancel();
              }}
              autoFocus
            />
            {isValidating && (
              <div className="text-xs text-gray-500">Validating...</div>
            )}
            <button
              onClick={handleEditSave}
              className={`px-2 py-1 text-white text-xs rounded ${
                validationError
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              disabled={!!validationError || isValidating}
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
          {validationError && (
            <div className="text-xs text-red-600 ml-2">
              {validationError}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        {renderPrimitiveValue()}
        {isEditable && (
          <>
            <button
              onClick={handleEditStart}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-all"
              title="Edit value"
            >
              <PencilIcon className="w-3 h-3" />
            </button>
            <button
              onClick={handleRulesClick}
              className="opacity-0 group-hover:opacity-100 p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-200 rounded transition-all"
              title="Configure rules"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </>
        )}
      </div>
    );
  };

  const renderArrayItems = () => {
    if (!isArray || depth > 10) return null; // Prevent infinite recursion

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
        expandedPaths={expandedPaths}
        onExpandToggle={onExpandToggle}
        onGetActiveTooltipPath={onGetActiveTooltipPath}
      />
    ));
  };

  const renderObjectProperties = () => {
    if (!isObject || depth > 10) return null; // Prevent infinite recursion

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
        expandedPaths={expandedPaths}
        onExpandToggle={onExpandToggle}
        onGetActiveTooltipPath={onGetActiveTooltipPath}
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
      case "COMPONENT":
        color = "text-teal-400";
        title = "From Component";
        break;
      case "VERSION":
        color = "text-amber-400";
        // Show component name with version in parentheses
        console.log("VERSION source object:", source);
        if (source.parentName && source.name) {
          title = `From ${source.parentName} (${source.name})`;
        } else {
          title = "From Version";
        }
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
        className={`flex items-center py-1 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-context-menu transition-colors`}
        style={{ paddingLeft: `${depth * 20}px` }}
        onContextMenu={handleContextMenu}
      >
        {/* Expand/Collapse button */}
        {(isObject || isArray) && (
          <button
            onClick={toggleExpanded}
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
          <span className="font-medium text-gray-700 dark:text-gray-300 mr-2">"{keyName}":</span>
        )}

        {/* Value */}
        {isPrimitive ? (
          renderEditableValue()
        ) : isArray ? (
          <span className="text-gray-600 dark:text-gray-400">[{actualValue.length} items]</span>
        ) : (
          <span className="text-gray-600 dark:text-gray-400">
            {`{${Object.keys(actualValue).length} properties}`}
          </span>
        )}

        {/* Inheritance indicator */}
        {getInheritanceIndicator()}

        {/* Provenance indicator */}
        {source && (
          <button
            onClick={handleInfoClick}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded ml-1"
            title="Show source information"
            data-info-icon
          >
            <InformationCircleIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Expanded children */}
      {isExpanded && (isObject || isArray) && (
        <div>{isArray ? renderArrayItems() : renderObjectProperties()}</div>
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

const InteractiveJSONViewer = ({
  data,
  rawData,
  metadata,
  title,
  className = "",
  isEditable = false,
  onDataChange,
  configType,
  selectedConfig,
}) => {
  const [hoveredSource, setHoveredSource] = useState(null);
  const [hoveredPath, setHoveredPath] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  // Rules dialog state
  const [rulesDialog, setRulesDialog] = useState({ isOpen: false, configurationId: null, propertyPath: null, existingRules: [] });
  const [showInheritanceChain, setShowInheritanceChain] = useState(false);
  // Global state to preserve expand/collapse states across data updates
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  // Mode toggle between Flat and Structural view
  const [viewMode, setViewMode] = useState("structural");
  // Mode toggle between All and Changes view
  const [dataMode, setDataMode] = useState("all");
  // Structural mode state
  const [selectedStructuralPath, setSelectedStructuralPath] = useState("root");
  const [selectedStructuralValue, setSelectedStructuralValue] = useState(data);

  // Helper to extract actual value from provenance wrapper
  const extractActualValue = useCallback((val) => {
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
  }, []);

  // Helper function to get value at a specific path
  const getValueAtPath = useCallback((obj, path) => {
    if (!obj || !path || path === "root") return obj;

    // Remove root prefix and handle array notation properly
    let cleanPath = path.replace(/^root\.?/, "");
    if (!cleanPath) return obj;

    let current = obj;
    let i = 0;

    while (i < cleanPath.length && current != null) {
      // Look for array notation [index]
      const bracketStart = cleanPath.indexOf('[', i);

      if (bracketStart === i) {
        // Path starts with array notation like "[0]"
        const bracketEnd = cleanPath.indexOf(']', i);
        if (bracketEnd === -1) return null;

        const index = parseInt(cleanPath.slice(i + 1, bracketEnd));

        // Extract actual value from provenance wrapper before checking if it's an array
        const actualCurrent = extractActualValue(current);

        if (Array.isArray(actualCurrent) && index >= 0 && index < actualCurrent.length) {
          current = actualCurrent[index];
          i = bracketEnd + 1;
          // Skip optional dot after bracket
          if (i < cleanPath.length && cleanPath[i] === '.') {
            i++;
          }
        } else {
          return null;
        }
      } else {
        // Look for next property name
        let nextDot = cleanPath.indexOf('.', i);
        let nextBracket = cleanPath.indexOf('[', i);

        // Find the next delimiter (dot or bracket)
        let nextDelimiter = -1;
        if (nextDot !== -1 && nextBracket !== -1) {
          nextDelimiter = Math.min(nextDot, nextBracket);
        } else if (nextDot !== -1) {
          nextDelimiter = nextDot;
        } else if (nextBracket !== -1) {
          nextDelimiter = nextBracket;
        }

        const key = nextDelimiter === -1
          ? cleanPath.slice(i)
          : cleanPath.slice(i, nextDelimiter);

        if (current && typeof current === "object" && current.hasOwnProperty(key)) {
          current = current[key];
          i = nextDelimiter === -1 ? cleanPath.length : nextDelimiter;
          // Skip dot delimiter
          if (i < cleanPath.length && cleanPath[i] === '.') {
            i++;
          }
        } else {
          return null;
        }
      }
    }

    return current;
  }, [extractActualValue]);

  // Initialize expanded paths for structural mode
  useEffect(() => {
    if (viewMode === "structural" && expandedPaths.size === 0) {
      setExpandedPaths(new Set(["root"]));
    }
  }, [viewMode]);

  // Reset structural path when switching data modes
  useEffect(() => {
    setSelectedStructuralPath("root");
  }, [dataMode]);

  // Get current data based on mode
  const getCurrentData = useCallback(() => {
    if (dataMode === "changes") {
      // rawData is the actual configuration data (rawResponse.data.resolved)
      return rawData || {};
    }
    return data;
  }, [dataMode, rawData, data]);

  // Check if changes mode has no data
  const hasNoChanges = dataMode === "changes" && (!rawData || Object.keys(rawData).length === 0);

  // Update selected structural value when data changes
  useEffect(() => {
    const currentData = getCurrentData();
    if (selectedStructuralPath === "root") {
      setSelectedStructuralValue(currentData);
    } else {
      const valueAtPath = getValueAtPath(currentData, selectedStructuralPath);
      setSelectedStructuralValue(valueAtPath);
    }
  }, [data, rawData, dataMode, selectedStructuralPath, getValueAtPath, getCurrentData]);

  const handleHover = (path, source, fullPath, clickEvent) => {
    setHoveredSource(source);
    setHoveredPath(fullPath);
    setShowTooltip(true);
    if (clickEvent) {
      setTooltipPosition({ x: clickEvent.clientX, y: clickEvent.clientY });
    }
  };

  const getActiveTooltipPath = () => {
    return showTooltip ? hoveredPath : null;
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
    // Strip "root." prefix from path since root is just a container
    const cleanPath = path.startsWith("root.") ? path.substring(5) : path;

    // Ensure we don't pass empty path for root level changes
    if (!cleanPath) {
      console.warn("Attempting to update root level, which is not allowed");
      return;
    }

    onDataChange?.(cleanPath, newValue);
  };

  const handleExpandToggle = (path, isExpanded) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (isExpanded) {
        newSet.add(path);
      } else {
        newSet.delete(path);
      }
      return newSet;
    });
  };

  const handleStructuralNodeSelect = (path, value) => {
    setSelectedStructuralPath(path);
    // Don't set the value directly - let the useEffect handle it to ensure consistency
    // setSelectedStructuralValue(value);
  };

  const handleNavigateToPath = (path) => {
    setSelectedStructuralPath(path);

    // Get the value at the target path
    const currentData = getCurrentData();
    const valueAtPath = getValueAtPath(currentData, path);
    setSelectedStructuralValue(valueAtPath);

    // Expand all parent paths in the tree
    const pathParts = path.split('.');
    let currentPath = '';

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];

      if (currentPath) {
        currentPath += `.${part}`;
      } else {
        currentPath = part;
      }

      // Always add to expanded paths, including intermediate paths
      // Only skip the target path itself (last one) since we want to expand parents
      if (i < pathParts.length - 1) {
        setExpandedPaths(prev => new Set([...prev, currentPath]));
      }
    }

    // If navigating to a direct child of root, make sure root is expanded
    if (pathParts.length === 2 && pathParts[0] === 'root') {
      setExpandedPaths(prev => new Set([...prev, 'root']));
    }
  };

  const handleStructuralChange = (action, path, param1, param2) => {
    if (!onDataChange) return;

    console.log("Structural change:", { action, path, param1, param2 });

    const setValueAtPath = (obj, path, value) => {
      if (!path || path === "root") return value;
      const keys = path.replace(/^root\./, "").split(".");
      const newObj = JSON.parse(JSON.stringify(obj));
      let current = newObj;

      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key] || typeof current[key] !== "object") {
          current[key] = {};
        }
        current = current[key];
      }

      const lastKey = keys[keys.length - 1];
      if (value === undefined) {
        delete current[lastKey];
      } else {
        current[lastKey] = value;
      }

      return newObj;
    };

    // Use current data based on mode
    const currentData = getCurrentData();

    switch (action) {
      case "add": {
        const parentPath = path.replace(/^root\./, "");
        const parentValue = getValueAtPath(currentData, path);

        if (parentValue && typeof parentValue === "object") {
          const newParentValue = { ...parentValue };
          newParentValue[param1] = param2;

          // Update the parent object with the new child
          if (parentPath) {
            onDataChange(parentPath, newParentValue);
          } else {
            // Adding to root level - replace each property individually
            onDataChange(param1, param2);
          }
        }
        break;
      }
      case "remove": {
        const cleanPath = path.replace(/^root\./, "");
        const pathParts = cleanPath.split(".");
        const parentPath = pathParts.slice(0, -1).join(".");
        const key = pathParts[pathParts.length - 1];

        const parentValue = getValueAtPath(currentData, parentPath ? `root.${parentPath}` : "root");
        if (parentValue && typeof parentValue === "object") {
          const newParentValue = { ...parentValue };
          delete newParentValue[key];

          if (parentPath) {
            onDataChange(parentPath, newParentValue);
          } else {
            // Removing from root level - set the key to undefined to delete it
            onDataChange(key, undefined);
          }

          // Clear selection if the removed item was selected or its parent
          if (selectedStructuralPath === path || selectedStructuralPath.startsWith(path + ".")) {
            setSelectedStructuralPath("root");
            // The useEffect will update selectedStructuralValue when data changes
          }
        }
        break;
      }
      case "rename": {
        const cleanPath = path.replace(/^root\./, "");
        const pathParts = cleanPath.split(".");
        const parentPath = pathParts.slice(0, -1).join(".");
        const oldKey = pathParts[pathParts.length - 1];
        const newKey = param1;

        // Prevent renaming to the same name or empty name
        if (!newKey || newKey === oldKey) {
          console.warn("Invalid rename operation");
          return;
        }

        const parentValue = getValueAtPath(currentData, parentPath ? `root.${parentPath}` : "root");
        if (parentValue && typeof parentValue === "object" && parentValue.hasOwnProperty(oldKey)) {
          // Check if new key already exists
          if (parentValue.hasOwnProperty(newKey)) {
            console.warn(`Key "${newKey}" already exists`);
            // You could add a toast notification here if needed
            return;
          }

          const newParentValue = { ...parentValue };
          newParentValue[newKey] = newParentValue[oldKey];
          delete newParentValue[oldKey];

          // Always update the parent object (whether it's a nested object or root)
          if (parentPath) {
            onDataChange(parentPath, newParentValue);
          } else {
            // For root level, we need to replace the entire root object
            onDataChange("_root_", newParentValue);
          }

          // Update selected path if it was the renamed item
          if (selectedStructuralPath === path) {
            const newPath = parentPath ? `root.${parentPath}.${newKey}` : `root.${newKey}`;
            setSelectedStructuralPath(newPath);
          }
        }
        break;
      }
    }
  };

  const handlePropertyAdd = (path, propertyName, value) => {
    if (!onDataChange) return;
    const cleanPath = path.replace(/^root\./, "");
    const propertyPath = cleanPath ? `${cleanPath}.${propertyName}` : propertyName;

    console.log("Adding property:", { path, propertyName, value, cleanPath, propertyPath });

    if (!propertyPath) {
      console.warn("Cannot add property to root level");
      return;
    }

    onDataChange(propertyPath, value);
  };

  const handlePropertyDelete = (path, propertyName) => {
    if (!onDataChange) return;
    const cleanPath = path.replace(/^root\./, "");

    console.log("Deleting property:", { path, propertyName, cleanPath });

    if (!cleanPath && propertyName) {
      // Deleting from root level
      onDataChange(propertyName, undefined);
    } else {
      // Get the parent object and remove the property
      const parentValue = selectedStructuralValue;
      if (parentValue && typeof parentValue === "object") {
        const newParentValue = { ...parentValue };
        delete newParentValue[propertyName];
        onDataChange(cleanPath, newParentValue);
      }
    }
  };

  if (!data) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        No data to display
      </div>
    );
  }

  const handleContainerClick = (e) => {
    // Close tooltip when clicking outside of info icons
    if (showTooltip && !e.target.closest('[data-info-icon]')) {
      setShowTooltip(false);
      setHoveredSource(null);
      setHoveredPath(null);
    }
  };

  return (
    <div className={`relative ${className}`} onMouseMove={handleMouseMove} onClick={handleContainerClick}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          {title && (
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("flat")}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === "flat"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <RectangleStackIcon className="w-4 h-4" />
              <span>Flat</span>
            </button>
            <button
              onClick={() => setViewMode("structural")}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === "structural"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <ViewColumnsIcon className="w-4 h-4" />
              <span>Structural</span>
            </button>
          </div>

          {/* Data Mode Toggle */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setDataMode("all")}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                dataMode === "all"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span>All</span>
            </button>
            <button
              onClick={() => setDataMode("changes")}
              className={`flex items-center space-x-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                dataMode === "changes"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span>Changes</span>
            </button>
          </div>
        </div>

        {metadata && viewMode === "flat" && (
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

      {/* Inheritance Legend - only show in flat mode */}
      {viewMode === "flat" && (
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
      )}

      {/* Inheritance Chain - only show in flat mode */}
      {viewMode === "flat" && showInheritanceChain && metadata && metadata.chain && (
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

      {/* Content based on view mode */}
      {hasNoChanges ? (
        /* No Changes Message */
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center transition-colors">
          <div className="text-gray-500 dark:text-gray-400">
            <div className="text-lg mb-2">No Local Changes</div>
            <div className="text-sm">This configuration has no local overrides. All values are inherited from parent configurations.</div>
          </div>
        </div>
      ) : viewMode === "flat" ? (
        /* Flat JSON Tree */
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-auto transition-colors">
          <TreeNode
            keyName="root"
            value={getCurrentData()}
            onHover={handleHover}
            onHoverEnd={handleHoverEnd}
            isRoot={true}
            isEditable={isEditable}
            onValueChange={handleValueChange}
            expandedPaths={expandedPaths}
            onExpandToggle={handleExpandToggle}
            onGetActiveTooltipPath={getActiveTooltipPath}
          />
        </div>
      ) : hasNoChanges ? (
        /* No Changes Message for Structural View */
        <div className="flex gap-4 h-96">
          <div className="w-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto transition-colors">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 transition-colors">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Structure</h4>
            </div>
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="text-sm">No local changes to display</div>
            </div>
          </div>
          <div className="w-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto transition-colors">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 transition-colors">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Properties</h4>
            </div>
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="text-sm">No local changes to display</div>
            </div>
          </div>
        </div>
      ) : (
        /* Structural View - Split Panel */
        <div className="flex gap-4 h-96">
          {/* Left Panel - Structure Tree */}
          <div className="w-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto transition-colors">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 transition-colors">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Structure</h4>
            </div>
            <div className="p-2">
              <StructuralTreeNode
                keyName="root"
                value={getCurrentData()}
                isRoot={true}
                isEditable={isEditable}
                expandedPaths={expandedPaths}
                onExpandToggle={handleExpandToggle}
                onNodeSelect={handleStructuralNodeSelect}
                selectedPath={selectedStructuralPath}
                onStructuralChange={handleStructuralChange}
                configType={configType}
                configName={title}
              />
            </div>
          </div>

          {/* Right Panel - Scalar Properties */}
          <div className="w-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-auto relative transition-colors">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 transition-colors">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Properties</h4>
            </div>
            <ScalarPropertiesPanel
              selectedPath={selectedStructuralPath}
              selectedValue={selectedStructuralValue}
              onValueChange={handleValueChange}
              onPropertyAdd={handlePropertyAdd}
              onPropertyDelete={handlePropertyDelete}
              isEditable={isEditable}
              onHover={handleHover}
              onHoverEnd={handleHoverEnd}
              onGetActiveTooltipPath={getActiveTooltipPath}
              onNavigateToPath={handleNavigateToPath}
              configType={configType}
              selectedConfig={selectedConfig}
              getCurrentData={getCurrentData}
            />
          </div>
        </div>
      )}

      {/* Tooltip */}
      <ProvenanceTooltip
        source={hoveredSource}
        isVisible={showTooltip}
        position={tooltipPosition}
        path={hoveredPath}
      />

      {/* Rules Dialog */}
      <RuleDefinitionDialog
        isOpen={rulesDialog.isOpen}
        onClose={() => setRulesDialog({ isOpen: false, configurationId: null, propertyPath: null, existingRules: [] })}
        configurationId={rulesDialog.configurationId}
        propertyPath={rulesDialog.propertyPath}
        existingRules={rulesDialog.existingRules}
        onRulesUpdated={(updatedRules) => {
          console.log("Rules updated:", updatedRules);
          showToast("Rules updated successfully", "success");
        }}
      />

      {/* Help text */}
      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {viewMode === "flat" ? (
          <>💡 Click ℹ️ to see source configuration • Colored dots indicate inheritance level{isEditable && " • Click ✏️ to edit values • Click ✓ to configure rules"} • Use "All"/"Changes" toggle to view resolved vs raw data</>
        ) : (
          <>💡 Select items in structure tree to view properties • {isEditable && "Right-click for structure editing • "} Click ℹ️ to see source configuration{isEditable && " • Click ✓ to configure rules"} • Use "All"/"Changes" toggle to view resolved vs raw data</>
        )}
      </div>
    </div>
  );
};

export default InteractiveJSONViewer;
