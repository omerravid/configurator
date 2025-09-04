import React, { useState, useEffect } from "react";
import {
  PencilIcon,
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
  ClipboardIcon,
  MapIcon,
  DocumentDuplicateIcon,
  ArrowRightIcon,
  CogIcon,
  FolderIcon,
  FolderPlusIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import { useToast } from "../context/ToastContext";
import ContextMenu from "./ContextMenu";
import { configAPI } from "../services/api";
import FileManagementPanel from "./FileManagementPanel";
import RuleDefinitionDialog from "./RuleDefinitionDialog";
import RuleAwareInput from "./RuleAwareInput";

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
  onNavigateToPath, // New prop for navigation
  configType, // New prop for configuration type
  selectedConfig, // New prop for reset functionality
  getCurrentData, // New prop for getting current data mode
}) => {
  const { showToast } = useToast();
  const [editingProperty, setEditingProperty] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [newPropertyName, setNewPropertyName] = useState("");
  const [newPropertyValue, setNewPropertyValue] = useState("");
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showAddLevel, setShowAddLevel] = useState(false);
  const [newLevelName, setNewLevelName] = useState("");
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [createAsArray, setCreateAsArray] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  // Component version management state
  const [availableVersions, setAvailableVersions] = useState([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Rules dialog state
  const [rulesDialog, setRulesDialog] = useState({ isOpen: false, configurationId: null, propertyPath: null, existingRules: [] });

  // Validation state
  const [validationError, setValidationError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

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

  // Check if a value is a scalar array (array containing only scalar values)
  const isScalarArray = (arr) => {
    if (!Array.isArray(arr)) return false;
    return arr.every(item => {
      const { actualValue } = getActualValueAndSource(item);
      return (
        actualValue === null ||
        actualValue === undefined ||
        typeof actualValue === "string" ||
        typeof actualValue === "number" ||
        typeof actualValue === "boolean"
      );
    });
  };

  // Get scalar arrays from the object
  const getScalarArrays = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }

    return Object.entries(value).filter(([key, val]) => {
      const { actualValue } = getActualValueAndSource(val);
      return isScalarArray(actualValue);
    });
  };

  const getScalarProperties = (value, isComponent = false) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }

    return Object.entries(value).filter(([key, val]) => {
      // Skip component-specific properties if this is a component reference
      if (isComponent && ['componentId', 'versionId', 'componentName', 'versionName'].includes(key)) {
        return false;
      }

      const { actualValue } = getActualValueAndSource(val);

      // Check if this property is itself a component reference
      const isComponentProperty = actualValue &&
        typeof actualValue === "object" &&
        !Array.isArray(actualValue) &&
        actualValue.componentId &&
        actualValue.versionId &&
        actualValue.componentName;

      // If it's a component property, don't show it as a scalar property
      // (it will be shown in the Objects section instead)
      if (isComponentProperty) {
        return false;
      }

      // If it's a scalar array, don't show it as a scalar property
      // (it will be shown in the Arrays section instead)
      if (isScalarArray(actualValue)) {
        return false;
      }

      // If it's a file object, don't show it as a scalar property
      // (it will be shown in the File Management section instead)
      if (actualValue &&
          typeof actualValue === "object" &&
          actualValue._type === "file" &&
          actualValue._link) {
        return false;
      }

      return (
        actualValue === null ||
        actualValue === undefined ||
        typeof actualValue === "string" ||
        typeof actualValue === "number" ||
        typeof actualValue === "boolean"
      );
    });
  };

  // Detect if the selected item is a file object
  const isFileObject = () => {
    if (!selectedValue || typeof selectedValue !== "object") return false;
    const { actualValue } = getActualValueAndSource(selectedValue);

    return actualValue &&
           typeof actualValue === "object" &&
           actualValue._type === "file" &&
           actualValue._link;
  };

  // Detect if the selected item is a component reference
  const isComponentReference = () => {
    if (!selectedValue || typeof selectedValue !== "object") return false;
    const { actualValue } = getActualValueAndSource(selectedValue);

    // Check if it's a component reference by looking for required properties
    if (actualValue && typeof actualValue === "object" && !Array.isArray(actualValue)) {
      // Check for component reference properties (allowing for some flexibility)
      const hasComponentId = actualValue.hasOwnProperty('componentId') && actualValue.componentId;
      const hasVersionId = actualValue.hasOwnProperty('versionId') && actualValue.versionId;
      const hasComponentName = actualValue.hasOwnProperty('componentName') && actualValue.componentName;

      const isComponentRef = hasComponentId && hasVersionId && hasComponentName;

      console.log("Component detection details:", {
        selectedPath,
        actualValue,
        hasComponentId: hasComponentId ? `Yes (${actualValue.componentId})` : 'No',
        hasVersionId: hasVersionId ? `Yes (${actualValue.versionId})` : 'No',
        hasComponentName: hasComponentName ? `Yes (${actualValue.componentName})` : 'No',
        allKeys: Object.keys(actualValue),
        isComponentRef,
        configType
      });

      return isComponentRef;
    }

    return false;
  };

  // Get sub-objects for navigation (includes both regular objects and component references)
  const getSubObjects = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return [];
    }

    return Object.entries(value).filter(([key, val]) => {
      const { actualValue } = getActualValueAndSource(val);

      // Include if it's any kind of object (including component references)
      const isObject = actualValue && typeof actualValue === "object" && !Array.isArray(actualValue);

      // Mark component references specially
      const isComponentRef = isObject &&
        actualValue.componentId &&
        actualValue.versionId &&
        actualValue.componentName;

      return isObject;
    });
  };

  const isCompRef = isComponentReference();
  const componentRef = isCompRef ? getActualValueAndSource(selectedValue).actualValue : null;
  const subObjects = getSubObjects(selectedValue);
  const scalarProperties = getScalarProperties(selectedValue, !!componentRef);
  const scalarArrays = getScalarArrays(selectedValue);
  const actualSelectedValue = selectedValue ? getActualValueAndSource(selectedValue).actualValue : null;

  // Debug logging for component detection and property filtering
  console.log("ScalarPropertiesPanel Debug:", {
    selectedPath,
    configType,
    isComponentRef: isCompRef,
    componentRef,
    selectedValue: actualSelectedValue,
    selectedValueType: typeof actualSelectedValue,
    allProperties: actualSelectedValue && typeof actualSelectedValue === 'object' ? Object.keys(actualSelectedValue) : [],
    scalarPropertiesCount: scalarProperties.length,
    subObjectsCount: subObjects.length,
    rawSelectedValue: selectedValue,
    isArrayElement: selectedPath.includes('[') && selectedPath.includes(']')
  });

  if (actualSelectedValue && typeof actualSelectedValue === 'object') {
    console.log("Full Tools object structure:", JSON.stringify(actualSelectedValue, null, 2));

    Object.entries(actualSelectedValue).forEach(([key, val]) => {
      const { actualValue, source } = getActualValueAndSource(val);
      const isScalar = (
        actualValue === null ||
        actualValue === undefined ||
        typeof actualValue === "string" ||
        typeof actualValue === "number" ||
        typeof actualValue === "boolean"
      );
      const isComponentProp = isCompRef && ['componentId', 'versionId', 'componentName', 'versionName'].includes(key);
      const isComponentRef = actualValue &&
        typeof actualValue === "object" &&
        !Array.isArray(actualValue) &&
        actualValue.componentId &&
        actualValue.versionId &&
        actualValue.componentName;

      console.log(`Property ${key}:`, {
        rawValue: val,
        actualValue,
        source,
        keys: actualValue && typeof actualValue === 'object' ? Object.keys(actualValue) : 'N/A',
        type: typeof actualValue,
        isScalar,
        isComponentProp,
        isComponentRef,
        hasProvenance: val !== actualValue,
        willShowAsScalar: isScalar && !isComponentProp && !isComponentRef,
        willShowAsObject: !isScalar || isComponentRef
      });
    });
  }


  // Load available versions when a component is selected
  useEffect(() => {
    console.log("Loading versions for component:", componentRef);

    if (componentRef) {
      setLoadingVersions(true);
      configAPI.getComponents()
        .then(response => {
          console.log("Components API response:", response);
          console.log("Response data type:", typeof response.data);
          console.log("Response data:", response.data);

          // Handle different response structures
          let componentsArray;
          if (Array.isArray(response.data)) {
            componentsArray = response.data;
          } else if (Array.isArray(response)) {
            componentsArray = response;
          } else if (response.data && Array.isArray(response.data.components)) {
            componentsArray = response.data.components;
          } else {
            console.error("Unexpected API response structure:", response);
            throw new Error("API response is not in expected format");
          }

          const component = componentsArray.find(c => c.id === componentRef.componentId);
          console.log("Found component for versions:", component);

          if (component) {
            // Include the component itself as the root version plus any child versions
            const versions = component.versions || [];

            // Check if the component ID already exists in versions to avoid duplicates
            const hasComponentAsVersion = versions.some(v => v.id === component.id);

            const allVersions = [];

            // Add component as root only if it's not already in versions
            if (!hasComponentAsVersion) {
              allVersions.push({
                id: component.id,
                name: `${component.name} (root)`,
                isRoot: true
              });
            }

            // Add all versions
            allVersions.push(...versions);

            setAvailableVersions(allVersions);
            console.log("Set available versions:", allVersions);
          } else {
            console.warn("Component not found in response:", componentRef.componentId);
            setAvailableVersions([]);
          }
        })
        .catch(error => {
          console.error("Failed to load component versions:", error);
          showToast("Failed to load component versions", "error");
        })
        .finally(() => {
          setLoadingVersions(false);
        });
    } else {
      setAvailableVersions([]);
    }
  }, [componentRef?.componentId]);

  const validateValue = async (propertyName, value) => {
    console.log("=== validateValue DEBUG ===");
    console.log("propertyName:", propertyName);
    console.log("value:", value);
    console.log("selectedConfig:", selectedConfig);

    if (!selectedConfig?.id) {
      console.log("No selectedConfig.id, returning true");
      return true;
    }

    // Build the full property path
    let fullPropertyPath;
    if (selectedPath === "root") {
      fullPropertyPath = propertyName;
    } else {
      // Remove "root." prefix from selectedPath if present
      const cleanSelectedPath = selectedPath.startsWith("root.") ? selectedPath.substring(5) : selectedPath;
      fullPropertyPath = `${cleanSelectedPath}.${propertyName}`;
    }

    console.log("fullPropertyPath:", fullPropertyPath);
    console.log("API payload:", {
      configurationId: selectedConfig.id,
      propertyPath: fullPropertyPath,
      value: value
    });

    try {
      setIsValidating(true);
      console.log("Making validation request...");
      const response = await fetch('/api/rules/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          configurationId: selectedConfig.id,
          propertyPath: fullPropertyPath,
          value: value
        })
      });

      console.log("Validation response status:", response.status);
      const result = await response.json();
      console.log("Validation result:", result);

      if (!response.ok) {
        console.log("Validation response not ok:", result);
        setValidationError(result.error || 'Validation failed');
        return false;
      }

      if (!result.isValid) {
        console.log("Validation failed:", result.errors);
        setValidationError(result.errors.join(', '));
        return false;
      }

      console.log("Validation passed");
      setValidationError("");
      return true;
    } catch (error) {
      console.error('Validation error:', error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      setValidationError('Validation service unavailable');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleEditStart = (propertyName, value) => {
    setEditingProperty(propertyName);
    setEditValue(safeToString(value));
    setValidationError("");
  };

  const handleEditSave = async (propertyName, newValue = null) => {
    // If newValue is provided (from RuleAwareInput), use it directly
    // Otherwise, use the old parsing logic for backwards compatibility
    if (newValue === null) {
      newValue = editValue;

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

      // Validate the value before saving for backward compatibility
      const isValid = await validateValue(propertyName, newValue);
      if (!isValid) {
        return; // Don't save if validation fails
      }
    }

    // Check if we're editing a property inside an array element
    const isArrayElementProperty = selectedPath.includes('[') && selectedPath.includes(']');

    if (isArrayElementProperty) {
      // Handle array element property editing - update the entire array
      handleArrayElementPropertyChange(propertyName, newValue);
    } else {
      // Normal property editing
      let propertyPath;
      if (selectedPath === "root") {
        propertyPath = `root.${propertyName}`;
      } else {
        propertyPath = `${selectedPath}.${propertyName}`;
      }

      console.log("ScalarPanel editing:", { propertyName, newValue, selectedPath, propertyPath });
      onValueChange?.(propertyPath, newValue);
    }

    setEditingProperty(null);
    setValidationError("");
  };

  const handleEditCancel = () => {
    setEditingProperty(null);
    setEditValue("");
    setValidationError("");
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

    // Check if we're adding a property to an array element
    const isArrayElementProperty = selectedPath.includes('[') && selectedPath.includes(']');

    if (isArrayElementProperty) {
      // Handle array element property addition - update the entire array
      handleArrayElementPropertyChange(newPropertyName, parsedValue);
    } else {
      // Normal property addition
      onPropertyAdd?.(selectedPath, newPropertyName, parsedValue);
    }

    setNewPropertyName("");
    setNewPropertyValue("");
    setShowAddProperty(false);
  };

  const handleDeleteProperty = (propertyName) => {
    // Check if we're deleting a property from an array element
    const isArrayElementProperty = selectedPath.includes('[') && selectedPath.includes(']');

    if (isArrayElementProperty) {
      // Handle array element property deletion - update the entire array
      handleArrayElementPropertyChange(propertyName, undefined);
    } else {
      // Normal property deletion
      onPropertyDelete?.(selectedPath, propertyName);
    }
  };

  // Array editing handlers
  const validateArrayItem = async (arrayName, value) => {
    if (!selectedConfig?.id) return true;

    // Build the full property path for the array
    let fullPropertyPath;
    if (selectedPath === "root") {
      fullPropertyPath = arrayName;
    } else {
      // Remove "root." prefix from selectedPath if present
      const cleanSelectedPath = selectedPath.startsWith("root.") ? selectedPath.substring(5) : selectedPath;
      fullPropertyPath = `${cleanSelectedPath}.${arrayName}`;
    }

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
          propertyPath: fullPropertyPath,
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
      console.error('Array validation error:', error);
      setValidationError('Validation service unavailable');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleArrayItemSave = async (arrayName, index, newValue = null) => {
    // If newValue is provided (from RuleAwareInput), use it directly
    // Otherwise, use the old parsing logic for backwards compatibility
    if (newValue === null) {
      newValue = editValue;

      // Parse the value appropriately
      try {
        if (editValue === "true" || editValue === "false") {
          newValue = editValue === "true";
        } else if (editValue === "null") {
          newValue = null;
        } else if (editValue === "" || editValue === undefined) {
          newValue = "";
        } else if (!isNaN(editValue) && editValue !== "" && editValue !== null) {
          newValue = Number(editValue);
        }
      } catch (e) {
        // Keep as string if parsing fails
      }

      // Validate the array item value for backward compatibility
      const isValid = await validateArrayItem(arrayName, newValue);
      if (!isValid) {
        return; // Don't save if validation fails
      }
    }

    handleArrayValueChange(arrayName, index, newValue);
    setEditingProperty(null);
    setValidationError("");
  };

  const handleArrayValueChange = (arrayName, index, newValue) => {
    console.log("Array value change:", { arrayName, index, newValue, selectedPath });

    // Get the current array, properly extracting from provenance wrapper
    const arrayWithProvenance = actualSelectedValue[arrayName];
    const { actualValue: currentArray } = getActualValueAndSource(arrayWithProvenance);

    console.log("Array with provenance:", arrayWithProvenance);
    console.log("Extracted array:", currentArray);

    if (!Array.isArray(currentArray)) {
      console.error("Not an array:", currentArray);
      return;
    }

    // Create a new array with the updated value
    const newArray = [...currentArray];

    // Use the already-parsed value directly
    newArray[index] = newValue;

    // Create the full path for the array
    let arrayPath;
    if (selectedPath === "root") {
      arrayPath = `root.${arrayName}`;
    } else {
      arrayPath = `${selectedPath}.${arrayName}`;
    }

    console.log("Updating array at path:", arrayPath, "with new array:", newArray);
    onValueChange?.(arrayPath, newArray);
  };

  const handleArrayItemAdd = (arrayName) => {
    const arrayWithProvenance = actualSelectedValue[arrayName];
    const { actualValue: currentArray } = getActualValueAndSource(arrayWithProvenance);

    if (!Array.isArray(currentArray)) return;

    const newArray = [...currentArray, ""];

    let arrayPath;
    if (selectedPath === "root") {
      arrayPath = `root.${arrayName}`;
    } else {
      arrayPath = `${selectedPath}.${arrayName}`;
    }

    onValueChange?.(arrayPath, newArray);
  };

  const handleArrayItemDelete = (arrayName, index) => {
    const arrayWithProvenance = actualSelectedValue[arrayName];
    const { actualValue: currentArray } = getActualValueAndSource(arrayWithProvenance);

    if (!Array.isArray(currentArray)) return;

    const newArray = currentArray.filter((_, i) => i !== index);

    let arrayPath;
    if (selectedPath === "root") {
      arrayPath = `root.${arrayName}`;
    } else {
      arrayPath = `${selectedPath}.${arrayName}`;
    }

    onValueChange?.(arrayPath, newArray);
  };

  const handleArrayReset = (arrayName) => {
    // Reset array to inherited value by removing the local override
    let arrayPath;
    if (selectedPath === "root") {
      arrayPath = `root.${arrayName}`;
    } else {
      arrayPath = `${selectedPath}.${arrayName}`;
    }

    console.log("Resetting array to default:", arrayPath);
    onValueChange?.(arrayPath, null); // null removes the override (undefined gets lost in JSON serialization)
    showToast(`Array "${arrayName}" reset to inherited value`, "success");
  };

  // Check if an array has local overrides (shows source from current config level)
  const arrayHasLocalOverride = (arrayValue) => {
    const { source } = getActualValueAndSource(arrayValue);
    // If source exists and is not from a parent, it's a local override
    return source && (
      !source.configId ||
      source.configId === (selectedConfig?.id || "") ||
      source.configName === (selectedConfig?.name || "")
    );
  };

  // Check if a scalar property has local overrides
  const propertyHasLocalOverride = (propertyValue) => {
    const { source } = getActualValueAndSource(propertyValue);
    // If source exists and is not from a parent, it's a local override
    return source && (
      !source.configId ||
      source.configId === (selectedConfig?.id || "") ||
      source.configName === (selectedConfig?.name || "")
    );
  };

  // Handle property changes inside array elements - updates the entire array
  const handleArrayElementPropertyChange = (propertyName, newValue) => {
    console.log("=== ARRAY ELEMENT PROPERTY CHANGE DEBUG ===");
    console.log("selectedPath:", selectedPath);
    console.log("propertyName:", propertyName);
    console.log("newValue:", newValue);
    console.log("actualSelectedValue:", actualSelectedValue);

    // Parse the selectedPath to get array path and index
    // Example: "root.ObjArray[0]" -> arrayPath: "root.ObjArray", index: 0
    const bracketStart = selectedPath.indexOf('[');
    const bracketEnd = selectedPath.indexOf(']');

    if (bracketStart === -1 || bracketEnd === -1 || bracketEnd <= bracketStart) {
      console.error("Could not parse array path:", selectedPath);
      return;
    }

    const arrayPath = selectedPath.slice(0, bracketStart);
    const arrayIndex = parseInt(selectedPath.slice(bracketStart + 1, bracketEnd));

    if (isNaN(arrayIndex) || arrayIndex < 0) {
      console.error("Invalid array index:", selectedPath);
      return;
    }

    console.log("Parsed path info:", {
      selectedPath,
      arrayPath,
      arrayIndex,
      propertyName,
      newValue
    });

    // Get the current array from the resolved data
    // We need to traverse the path to get the array
    const cleanArrayPath = arrayPath.replace(/^root\.?/, '');
    console.log("cleanArrayPath:", cleanArrayPath);

    // We need to get the array from the root data, not from actualSelectedValue
    // actualSelectedValue is the array element, not the parent containing the array

    // First, get the root data (we need to go up from selectedStructuralValue to root)
    const rootData = getCurrentData(); // Get the current data (resolved or raw)
    console.log("rootData:", rootData);

    let currentData = rootData;

    if (cleanArrayPath) {
      const pathKeys = cleanArrayPath.split('.');
      console.log("pathKeys:", pathKeys);

      // Navigate to the parent object containing the array
      for (let i = 0; i < pathKeys.length - 1; i++) {
        if (currentData && typeof currentData === 'object') {
          const extractedValue = getActualValueAndSource(currentData[pathKeys[i]]);
          currentData = extractedValue.actualValue;
          console.log(`After navigating to ${pathKeys[i]}:`, currentData);
        }
      }

      // Get the array
      const arrayKey = pathKeys[pathKeys.length - 1];
      console.log("arrayKey:", arrayKey);
      var arrayWithProvenance = currentData ? currentData[arrayKey] : null;
    } else {
      // Array is at root level
      var arrayWithProvenance = currentData;
    }

    console.log("arrayWithProvenance:", arrayWithProvenance);
    const { actualValue: currentArray } = getActualValueAndSource(arrayWithProvenance);
    console.log("currentArray:", currentArray);

    if (!Array.isArray(currentArray)) {
      console.error("Target is not an array:", currentArray);
      return;
    }

    // Create a new array with the updated element
    const newArray = [...currentArray];
    if (arrayIndex < newArray.length) {
      // Clone the array element and update the property
      const elementToUpdate = getActualValueAndSource(newArray[arrayIndex]).actualValue;
      if (elementToUpdate && typeof elementToUpdate === 'object') {
        const updatedElement = { ...elementToUpdate };

        if (newValue === undefined) {
          // Delete the property
          delete updatedElement[propertyName];
        } else {
          // Update the property
          updatedElement[propertyName] = newValue;
        }

        newArray[arrayIndex] = updatedElement;
      }
    }

    // Update the entire array
    onValueChange?.(arrayPath, newArray);
    showToast(`Updated property "${propertyName}" in array element`, "success");
  };

  // Reset a scalar property to inherited value
  const handlePropertyReset = (propertyName) => {
    // Check if we're resetting a property in an array element
    const isArrayElementProperty = selectedPath.includes('[') && selectedPath.includes(']');

    if (isArrayElementProperty) {
      // Handle array element property reset - update the entire array
      handleArrayElementPropertyChange(propertyName, null);
    } else {
      // Normal property reset
      let propertyPath;
      if (selectedPath === "root") {
        propertyPath = `root.${propertyName}`;
      } else {
        propertyPath = `${selectedPath}.${propertyName}`;
      }

      console.log("Resetting property to default:", propertyPath);
      onValueChange?.(propertyPath, null); // null removes the override
      showToast(`Property "${propertyName}" reset to inherited value`, "success");
    }
  };

  // Handle opening the rules dialog for a property or array
  const handleRulesClick = async (propertyName) => {
    console.log("=== handleRulesClick DEBUG ===");
    console.log("propertyName:", propertyName);
    console.log("selectedConfig:", selectedConfig);
    console.log("selectedPath:", selectedPath);
    console.log("localStorage token:", localStorage.getItem('token') ? 'Present' : 'Missing');

    if (!selectedConfig?.id) {
      console.warn("No configuration ID available for rules");
      return;
    }

    // Build the full property path
    let fullPropertyPath;
    if (selectedPath === "root") {
      fullPropertyPath = propertyName;
    } else {
      // Remove "root." prefix from selectedPath if present
      const cleanSelectedPath = selectedPath.startsWith("root.") ? selectedPath.substring(5) : selectedPath;
      fullPropertyPath = `${cleanSelectedPath}.${propertyName}`;
    }

    console.log("fullPropertyPath:", fullPropertyPath);
    const apiUrl = `/api/rules/configuration/${selectedConfig.id}/path/${encodeURIComponent(fullPropertyPath)}`;
    console.log("API URL:", apiUrl);

    try {
      // Fetch existing rules for this property
      console.log("Making fetch request...");
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      let existingRules = [];
      if (response.ok) {
        const data = await response.json();
        console.log("Raw API response:", data);
        // API returns { rules: [...] } so extract the rules array
        existingRules = Array.isArray(data.rules) ? data.rules : (Array.isArray(data) ? data : []);
      }
      console.log("Existing rules:", existingRules);

      setRulesDialog({
        isOpen: true,
        configurationId: selectedConfig.id,
        propertyPath: fullPropertyPath,
        existingRules
      });
    } catch (error) {
      console.error("Failed to fetch existing rules:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      setRulesDialog({
        isOpen: true,
        configurationId: selectedConfig.id,
        propertyPath: fullPropertyPath,
        existingRules: [] // Explicitly ensure it's an empty array
      });
    }
  };

  // Handle opening the rules dialog for an array
  const handleArrayRulesClick = async (arrayName) => {
    console.log("=== handleArrayRulesClick DEBUG ===");
    console.log("arrayName:", arrayName);
    console.log("selectedConfig:", selectedConfig);
    console.log("selectedPath:", selectedPath);
    console.log("localStorage token:", localStorage.getItem('token') ? 'Present' : 'Missing');

    if (!selectedConfig?.id) {
      console.warn("No configuration ID available for array rules");
      return;
    }

    // Build the full property path for the array (without index notation)
    let fullPropertyPath;
    if (selectedPath === "root") {
      fullPropertyPath = arrayName;
    } else {
      // Remove "root." prefix from selectedPath if present
      const cleanSelectedPath = selectedPath.startsWith("root.") ? selectedPath.substring(5) : selectedPath;
      fullPropertyPath = `${cleanSelectedPath}.${arrayName}`;
    }

    console.log("fullPropertyPath:", fullPropertyPath);
    const apiUrl = `/api/rules/configuration/${selectedConfig.id}/path/${encodeURIComponent(fullPropertyPath)}`;
    console.log("API URL:", apiUrl);

    try {
      // Fetch existing rules for this array
      console.log("Making fetch request...");
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      let existingRules = [];
      if (response.ok) {
        const data = await response.json();
        console.log("Raw API response:", data);
        // API returns { rules: [...] } so extract the rules array
        existingRules = Array.isArray(data.rules) ? data.rules : (Array.isArray(data) ? data : []);
      }
      console.log("Existing array rules:", existingRules);

      setRulesDialog({
        isOpen: true,
        configurationId: selectedConfig.id,
        propertyPath: fullPropertyPath,
        existingRules
      });
    } catch (error) {
      console.error("Failed to fetch existing array rules:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      setRulesDialog({
        isOpen: true,
        configurationId: selectedConfig.id,
        propertyPath: fullPropertyPath,
        existingRules: [] // Explicitly ensure it's an empty array
      });
    }
  };

  // Reset all properties and arrays at current level to inherited values
  const handleResetAll = () => {
    if (!selectedValue || typeof selectedValue !== "object") return;

    // Get all properties that have local overrides at this level
    const allPropertiesToReset = [];

    // Add scalar properties with local overrides
    scalarProperties.forEach(([propertyName, value]) => {
      if (propertyHasLocalOverride(value)) {
        allPropertiesToReset.push(propertyName);
      }
    });

    // Add arrays with local overrides
    scalarArrays.forEach(([arrayName, arrayValue]) => {
      if (arrayHasLocalOverride(arrayValue)) {
        allPropertiesToReset.push(arrayName);
      }
    });

    if (allPropertiesToReset.length === 0) {
      showToast("No local changes to reset at this level", "info");
      return;
    }

    // Reset each property
    allPropertiesToReset.forEach(propertyName => {
      let propertyPath;
      if (selectedPath === "root") {
        propertyPath = `root.${propertyName}`;
      } else {
        propertyPath = `${selectedPath}.${propertyName}`;
      }
      onValueChange?.(propertyPath, null);
    });

    showToast(`Reset ${allPropertiesToReset.length} local changes at this level`, "success");
  };

  // Check if there are any local overrides at current level
  const hasLocalOverrides = () => {
    if (!selectedValue || typeof selectedValue !== "object") return false;

    // Check scalar properties
    const hasScalarOverrides = scalarProperties.some(([, value]) => propertyHasLocalOverride(value));

    // Check arrays
    const hasArrayOverrides = scalarArrays.some(([, arrayValue]) => arrayHasLocalOverride(arrayValue));

    return hasScalarOverrides || hasArrayOverrides;
  };

  const handleVersionChange = (newVersionId) => {
    console.log("Version change handler called:", {
      newVersionId,
      componentRef,
      availableVersions,
      selectedPath
    });

    if (!componentRef || !newVersionId) {
      console.log("Version change aborted: missing componentRef or versionId");
      return;
    }

    const selectedVersion = availableVersions.find(v => v.id === newVersionId);
    if (!selectedVersion) {
      console.log("Version change aborted: selected version not found");
      return;
    }

    // Update the component reference
    const updatedComponentRef = {
      ...componentRef,
      versionId: newVersionId,
      versionName: selectedVersion.name
    };

    console.log("Updating component reference:", {
      old: componentRef,
      new: updatedComponentRef
    });

    // Create the path for the component reference and update it
    onValueChange?.(selectedPath, updatedComponentRef);
    showToast(`Component version updated to ${selectedVersion.name}`, "success");
  };

  const handleRemoveComponent = () => {
    if (!componentRef || !selectedPath) {
      console.log("Remove component aborted: missing componentRef or selectedPath");
      return;
    }

    console.log("=== REMOVE COMPONENT DEBUG ===");
    console.log("componentRef:", componentRef);
    console.log("selectedPath:", selectedPath);

    // Extract the component path (should be at root level)
    // If we're viewing a nested path like "root.ComponentName.property",
    // we want to remove just "root.ComponentName"
    let componentPath = selectedPath;

    // If the path starts with "root.", get the next level (the component name)
    if (selectedPath.startsWith("root.")) {
      const pathParts = selectedPath.split(".");
      if (pathParts.length >= 2) {
        componentPath = `${pathParts[0]}.${pathParts[1]}`; // "root.ComponentName"
      }
    }

    console.log("Computed componentPath for removal:", componentPath);

    // Remove the component by setting the value to undefined
    // For component removal, we need to pass null explicitly to indicate deletion
    console.log("Calling onValueChange with:", { path: componentPath, value: null });
    onValueChange?.(componentPath, null);
    showToast(`Removed ${componentRef.componentName} from product`, "success");
  };

  const handleNavigateToSubObject = (subObjectKey) => {
    if (!selectedPath || !onNavigateToPath) return;

    const newPath = selectedPath === "root"
      ? `root.${subObjectKey}`
      : `${selectedPath}.${subObjectKey}`;

    onNavigateToPath(newPath);
  };

  const copyToClipboard = async (text, label = "Value") => {
    // Always use fallback since Clipboard API is blocked in iframes
    console.log(`Attempting to copy ${label}:`, text);
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
        console.log(`Successfully copied ${label}`);
        showToast(`${label} copied to clipboard!`);
      } else {
        console.error(`Failed to copy ${label} - execCommand returned false`);
        showToast("Failed to copy to clipboard", "error");
      }
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
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

    // Create the full path for this property (matching flat view logic)
    const fullPath = selectedPath === "root"
      ? `root.${propertyName}`
      : `${selectedPath}.${propertyName}`;

    // Strip "root." prefix for display (matching flat view)
    const cleanPath = fullPath.startsWith("root.")
      ? fullPath.substring(5)
      : fullPath;

    const menuItems = [
      {
        label: "Copy Value",
        icon: ClipboardIcon,
        onClick: () => {
          console.log("Copy Value clicked for:", propertyName, actualValue);
          copyToClipboard(JSON.stringify(actualValue), "Value");
        },
      },
      {
        label: "Copy Path",
        icon: MapIcon,
        onClick: () => {
          console.log("Copy Path clicked for:", propertyName, "path:", cleanPath);
          copyToClipboard(cleanPath, "Path");
        },
      },
      {
        label: "Copy as JSON",
        icon: DocumentDuplicateIcon,
        onClick: () => {
          console.log("Copy as JSON clicked for:", propertyName, actualValue);
          copyToClipboard(JSON.stringify(actualValue, null, 2), "JSON");
        },
      },
    ];

    if (isEditable && configType !== "PRODUCT") {
      // Value editing allowed for all editable configurations except PRODUCT
      menuItems.unshift({
        label: "Edit Value",
        icon: PencilIcon,
        onClick: () => handleEditStart(propertyName, value),
      });

      // Reset to inherited value if this property has local overrides
      if (propertyHasLocalOverride(value)) {
        menuItems.push({
          label: "Reset to Inherited",
          icon: () => <span className="text-orange-500 text-sm font-bold">↺</span>,
          onClick: () => handlePropertyReset(propertyName),
        });
      }

      // Property deletion only allowed in COMPONENT configurations
      if (configType === "COMPONENT") {
        menuItems.push({
          label: "Delete Property",
          icon: TrashIcon,
          onClick: () => handleDeleteProperty(propertyName),
        });
      }
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
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <div className="text-lg mb-2">Properties Panel</div>
        <div className="text-sm">Select an item from the structure tree to view its scalar properties</div>
      </div>
    );
  }

  const handleContainerClick = (e) => {
    // Close context menu when clicking elsewhere
    if (contextMenu && !e.target.closest('.context-menu')) {
      setContextMenu(null);
    }
  };

  return (
    <div className="p-4" onClick={handleContainerClick}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          {componentRef ? "Component" : "Properties"}
        </h3>
        <div className="flex items-center space-x-2">
          {isEditable && !componentRef && hasLocalOverrides() && (
            <button
              onClick={handleResetAll}
              className="flex items-center space-x-1 px-2 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
              title="Reset all local changes at this level"
            >
              <span className="text-sm font-bold">↺</span>
              <span>Reset All</span>
            </button>
          )}
          {isEditable && !componentRef && configType === "COMPONENT" && (
            <>
              <button
                onClick={() => setShowAddProperty(true)}
                className="flex items-center space-x-1 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add Property</span>
              </button>
              <button
                onClick={() => setShowAddLevel(true)}
                className="flex items-center space-x-1 px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                <FolderPlusIcon className="w-4 h-4" />
                <span>Add Level</span>
              </button>
              <button
                onClick={() => setShowFileUpload(true)}
                className="flex items-center space-x-1 px-2 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                <ArrowUpTrayIcon className="w-4 h-4" />
                <span>Upload File</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Path: <span className="font-mono bg-gray-100 px-1 rounded">{selectedPath}</span>
        <button
          onClick={() => {
            // Strip "root." prefix for display consistency
            const cleanPath = selectedPath.startsWith("root.")
              ? selectedPath.substring(5)
              : selectedPath;
            console.log("Header path copy clicked, selectedPath:", selectedPath, "cleanPath:", cleanPath);
            copyToClipboard(cleanPath, "Path");
          }}
          className="ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
          title="Copy path"
        >
          <ClipboardIcon className="w-3 h-3" />
        </button>
      </div>

      {/* Component Reference - Compact Version */}
      {componentRef && (
        <div className="mb-6">
          <div
            className="group flex items-center justify-between p-2 border border-blue-200 rounded hover:bg-blue-50 bg-blue-25"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <CogIcon className="w-4 h-4 text-blue-600" />
                <span className="font-medium text-gray-700 dark:text-gray-300">version:</span>
                {configType === "PRODUCT" && isEditable ? (
                  <select
                    value={safeToString(componentRef.versionId)}
                    onChange={(e) => handleVersionChange(e.target.value)}
                    disabled={loadingVersions}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {availableVersions.map(version => (
                      <option key={version.id} value={version.id}>
                        {version.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-blue-600">
                    {safeToString(componentRef.versionName) || 'Unknown Version'}
                  </span>
                )}
                {loadingVersions && (
                  <span className="text-xs text-gray-500">Loading...</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {configType === "PRODUCT" && isEditable && (
                <button
                  onClick={handleRemoveComponent}
                  className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                  title="Remove this component from the product"
                >
                  <TrashIcon className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Property Form */}
      {showAddProperty && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded transition-colors">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Add New Property</h4>
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

      {/* Add Level Form */}
      {showAddLevel && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded transition-colors">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Add New Level</h4>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Level name (creates empty object)"
              value={newLevelName}
              onChange={(e) => setNewLevelName(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  if (!newLevelName.trim()) {
                    showToast("Level name cannot be empty", "error");
                    return;
                  }

                  if (selectedValue && selectedValue.hasOwnProperty(newLevelName)) {
                    showToast("Level already exists", "error");
                    return;
                  }

                  // Create a new empty object at this level
                  const newEmptyObject = {};
                  onPropertyAdd?.(selectedPath, newLevelName, newEmptyObject);

                  setNewLevelName("");
                  setShowAddLevel(false);
                  showToast(`Level "${newLevelName}" created successfully`, "success");
                }}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddLevel(false);
                  setNewLevelName("");
                }}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Form */}
      {showFileUpload && (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded transition-colors">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Upload File</h4>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Property name for the file"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {selectedFile && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </div>
            )}
            <div className="flex space-x-2">
              <button
                onClick={async () => {
                  if (!newFileName.trim()) {
                    showToast("File property name cannot be empty", "error");
                    return;
                  }

                  if (!selectedFile) {
                    showToast("Please select a file to upload", "error");
                    return;
                  }

                  if (selectedValue && selectedValue.hasOwnProperty(newFileName)) {
                    showToast("Property already exists", "error");
                    return;
                  }

                  try {
                    // Handle root path correctly - don't add dot prefix if at root
                    const propertyPath = selectedPath === "root" ? newFileName : `${selectedPath.replace(/^root\./, "")}.${newFileName}`;
                    const response = await configAPI.replaceFile(selectedConfig?.id, propertyPath, selectedFile);

                    if (response.data.success) {
                      showToast(`File "${selectedFile.name}" uploaded successfully`, "success");

                      // Create file object structure
                      const fileObject = {
                        _type: "file",
                        _metadata: response.data.metadata,
                        _link: response.data.downloadUrl
                      };

                      // Add the file property to the configuration
                      onPropertyAdd?.(selectedPath, newFileName, fileObject);

                      setNewFileName("");
                      setSelectedFile(null);
                      setShowFileUpload(false);
                    } else {
                      showToast(`Failed to upload file: ${response.data.error}`, "error");
                    }
                  } catch (error) {
                    console.error('File upload error:', error);
                    showToast(`Failed to upload file: ${error.message}`, "error");
                  }
                }}
                className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              >
                Upload
              </button>
              <button
                onClick={() => {
                  setShowFileUpload(false);
                  setNewFileName("");
                  setSelectedFile(null);
                }}
                className="px-3 py-1 bg-gray-500 text-white text-sm rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Object Management */}
      {isFileObject() && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">File Management</h4>
          <FileManagementPanel
            fileValue={getActualValueAndSource(selectedValue).actualValue}
            configId={selectedConfig?.id}
            propertyPath={selectedPath === "root" ? null : selectedPath.replace(/^root\./, "")}
            onFileUpdated={(newFileData) => {
              // Trigger a refresh of the configuration data
              // The parent component should handle this by refetching the configuration
              const propertyPath = selectedPath === "root" ? null : selectedPath.replace(/^root\./, "");
              if (propertyPath && onValueChange) {
                onValueChange(propertyPath, newFileData);
              }
            }}
            isEditable={isEditable}
          />
        </div>
      )}

      {/* Help text */}
      <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        💡 Right-click on properties for more options • Click ℹ️ to see source configuration
        {subObjects.length > 0 && " • Use 'Go to' buttons to navigate to objects"}
      </div>

      {/* Properties List */}
      {scalarProperties.length > 0 && (
        <div className="space-y-2 mb-6">
          {scalarProperties.map(([propertyName, value]) => {
            const { source } = getActualValueAndSource(value);
            const isEditing = editingProperty === propertyName;

            return (
              <div
                key={propertyName}
                className="group flex items-center justify-between p-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-context-menu transition-colors"
                onContextMenu={(e) => handlePropertyContextMenu(e, propertyName, value)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{propertyName}:</span>
                    {isEditing ? (
                      <RuleAwareInput
                        value={getActualValueAndSource(value).actualValue}
                        configurationId={selectedConfig?.id}
                        propertyPath={selectedPath === "root" ? propertyName : `${selectedPath.replace(/^root\./, "")}.${propertyName}`}
                        onSave={(newValue) => handleEditSave(propertyName, newValue)}
                        onCancel={handleEditCancel}
                        className="flex-1"
                      />
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
                    {isEditable && configType !== "PRODUCT" && (
                      <>
                        <button
                          onClick={() => handleEditStart(propertyName, value)}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                          title="Edit value"
                        >
                          <PencilIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRulesClick(propertyName)}
                          className="p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                          title="Configure rules"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>
                        {propertyHasLocalOverride(value) && (
                          <button
                            onClick={() => handlePropertyReset(propertyName)}
                            className="p-1 text-orange-400 hover:text-orange-600 hover:bg-orange-100 rounded"
                            title="Reset to inherited value"
                          >
                            <span className="text-xs font-bold">↺</span>
                          </button>
                        )}
                        {configType === "COMPONENT" && (
                          <button
                            onClick={() => handleDeleteProperty(propertyName)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                            title="Delete property"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Arrays List */}
      {scalarArrays.length > 0 && (
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Arrays</h4>
          {scalarArrays.map(([arrayName, arrayValue]) => {
            const { actualValue: actualArray } = getActualValueAndSource(arrayValue);

            return (
              <div key={arrayName} className="border border-gray-200 dark:border-gray-600 rounded p-3 bg-gray-50 dark:bg-gray-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-700 dark:text-gray-300">{arrayName}:</span>
                  {isEditable && configType !== "PRODUCT" && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleArrayRulesClick(arrayName)}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        title="Configure rules for all array items"
                      >
                        <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Rules
                      </button>
                      <button
                        onClick={() => handleArrayItemAdd(arrayName)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        title="Add array item"
                      >
                        + Add
                      </button>
                      {arrayHasLocalOverride(arrayValue) && (
                        <button
                          onClick={() => handleArrayReset(arrayName)}
                          className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                          title="Reset to inherited value"
                        >
                          Reset
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 pl-4">
                  {actualArray.map((item, index) => {
                    const { actualValue: actualItem } = getActualValueAndSource(item);
                    const itemKey = `${arrayName}-${index}`;
                    const isEditingItem = editingProperty === itemKey;

                    return (
                      <div
                        key={index}
                        className="group flex items-center justify-between p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400 min-w-0">[{index}]:</span>
                            {isEditingItem ? (
                              <div className="flex-1">
                                <RuleAwareInput
                                  value={getActualValueAndSource(item).actualValue}
                                  configurationId={selectedConfig?.id}
                                  propertyPath={`${selectedPath === "root" ? arrayName : `${selectedPath.replace(/^root\./, "")}.${arrayName}`}[${index}]`}
                                  onSave={(newValue) => handleArrayItemSave(arrayName, index, newValue)}
                                  onCancel={handleEditCancel}
                                  className="flex-1"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2 flex-1">
                                {renderPropertyValue(item)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Array Item Actions */}
                        {!isEditingItem && isEditable && configType !== "PRODUCT" && (
                          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingProperty(itemKey);
                                setEditValue(safeToString(actualItem));
                              }}
                              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                              title="Edit array item"
                            >
                              <PencilIcon className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleArrayItemDelete(arrayName, index)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-100 rounded"
                              title="Delete array item"
                            >
                              <TrashIcon className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {actualArray.length === 0 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic pl-2">Empty array</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Objects Navigation */}
      {subObjects.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Objects</h4>
          <div className="space-y-1">
            {subObjects.map(([key, value]) => {
              const { actualValue } = getActualValueAndSource(value);
              const isComponentRef = actualValue &&
                actualValue.componentId &&
                actualValue.versionId &&
                actualValue.componentName;

              return (
                <div key={key} className={`flex items-center justify-between p-2 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  isComponentRef ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700' : 'bg-gray-50 dark:bg-gray-700'
                }`}>
                  <div className="flex items-center space-x-2">
                    {isComponentRef ? (
                      <CogIcon className="w-4 h-4 text-blue-600" />
                    ) : (
                      <FolderIcon className="w-4 h-4 text-gray-500" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{key}</span>
                      {isComponentRef && (
                        <span className="text-xs text-blue-600">
                          {safeToString(actualValue.componentName)} ({safeToString(actualValue.versionName)})
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleNavigateToSubObject(key)}
                    className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    title={`Navigate to ${key}`}
                  >
                    <ArrowRightIcon className="w-3 h-3" />
                    <span>Go to</span>
                  </button>
                </div>
              );
            })}
          </div>
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
    </div>
  );
};

export default ScalarPropertiesPanel;
