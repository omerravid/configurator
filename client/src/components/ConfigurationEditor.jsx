import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { configAPI } from "../services/api";
import { XMarkIcon, FolderArrowDownIcon } from "@heroicons/react/24/outline";
import ComponentSelector from "./ComponentSelector";

const ConfigurationEditor = ({
  config,
  onClose,
  isCreatingProduct = false,
  isCreatingComponent = false,
  isRenaming = false,
  isCreatingChild = false,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();
  // Determine if we're creating a new config or editing an existing one
  const [isCreating, setIsCreating] = useState(
    isCreatingProduct || isCreatingComponent || isCreatingChild || !config,
  );
  const [loading, setLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);
  const [showRename, setShowRename] = useState(isRenaming);
  const [loadingRawData, setLoadingRawData] = useState(false);
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [computedComponentData, setComputedComponentData] = useState({});

  // Initialize component selections from existing product data
  const initializeComponentSelections = async (productData) => {
    try {
      // Get all available components
      const response = await configAPI.getComponents();
      const availableComponents = response.data.components;

      const selections = [];
      let selectionId = 1;

      // For each property in the product data, check if it's a component reference
      for (const [key, value] of Object.entries(productData)) {
        if (value && typeof value === 'object' && value.versionId) {
          // New-style component reference
          selections.push({
            id: selectionId++,
            componentId: value.componentId,
            versionId: value.versionId,
            componentName: value.componentName,
            versionName: value.versionName,
          });
        } else {
          // Old-style or backwards compatibility - try to match by component name
          const component = availableComponents.find(c => c.name === key);
          if (component) {
            // Find the version that matches the data
            const version = component.versions.find(v =>
              JSON.stringify(v.data) === JSON.stringify(value)
            ) || component.versions[0]; // Fallback to first version

            if (version) {
              selections.push({
                id: selectionId++,
                componentId: component.id,
                versionId: version.id,
                componentName: component.name,
                versionName: version.name,
              });
            }
          }
        }
      }

      setSelectedComponents(selections);
      setComputedComponentData(productData);
    } catch (error) {
      console.error("Failed to initialize component selections:", error);
    }
  };

  // Check if user can edit this configuration
  const canEdit = () => {
    if (
      isCreating ||
      isCreatingChild ||
      isCreatingProduct ||
      isCreatingComponent ||
      showRename
    )
      return true;
    if (!config) return true;
    if (user.role === "ADMIN") return true;

    return (
      config.type === "USER" &&
      config.created_by === user.username &&
      config.status === "DRAFT"
    );
  };

  const [formData, setFormData] = useState({
    name: "",
    type: isCreatingProduct ? "PRODUCT" : "USER",
    parent_id: "",
    description: "",
    data: isCreatingProduct ? "{\n  \n}" : "{}",
  });

  // Load the raw configuration data (not resolved) when editing
  useEffect(() => {
    const loadRawConfigData = async () => {
      if (config && !isCreating && !isCreatingProduct) {
        // EDITING an existing configuration
        setLoadingRawData(true);
        try {
          // Fetch the raw configuration data (without provenance/resolution)
          const response = await configAPI.getRawById(config.id);

          // Use the raw data from this specific configuration level
          setFormData({
            name: config.name,
            type: config.type, // Keep the original type
            parent_id: config.parent_id || "", // Keep the original parent
            description: config.description || "",
            data: JSON.stringify(response.data.resolved || {}, null, 2),
          });

          // If this is a PRODUCT, try to parse component selections from the raw data
          if (config.type === "PRODUCT") {
            try {
              const rawData = response.data.resolved || {};
              await initializeComponentSelections(rawData);
            } catch (err) {
              console.error("Failed to initialize component selections:", err);
            }
          }
        } catch (err) {
          console.error("Failed to load raw config data:", err);
          // Fallback to using the passed config data
          setFormData({
            name: config.name,
            type: config.type, // Keep the original type
            parent_id: config.parent_id || "", // Keep the original parent
            description: config.description || "",
            data: JSON.stringify(config.data || {}, null, 2),
          });
        } finally {
          setLoadingRawData(false);
        }
      } else if (
        config &&
        (isCreating || isCreatingChild) &&
        !isCreatingProduct
      ) {
        // CREATING a child configuration (config is the parent)
        // Start with empty data, not the parent's data
        setFormData((prev) => ({
          ...prev,
          name: "", // Empty name for new config
          parent_id: config.id, // The selected config becomes the parent
          type:
            config.type === "PRODUCT"
              ? "INSTANCE"
              : config.type === "COMPONENT"
                ? "VERSION"
                : "USER", // Determine child type
          description: "", // Empty description
          data: "{}", // Start with empty JSON object
        }));
      } else if (isCreatingProduct) {
        // CREATING a new product configuration
        setFormData((prev) => ({
          ...prev,
          name: "",
          type: "PRODUCT",
          parent_id: "", // Products have no parent
          description: "",
          data: "{\n  \n}", // Empty template for product
        }));
      } else if (isCreatingComponent) {
        // CREATING a new component configuration
        setFormData((prev) => ({
          ...prev,
          name: "",
          type: "COMPONENT",
          parent_id: "", // Components have no parent
          description: "",
          data: "{\n  \n}", // Empty template for component
        }));
      }
    };

    loadRawConfigData();
  }, [
    config,
    isCreating,
    isCreatingProduct,
    isCreatingComponent,
    isCreatingChild,
  ]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateJSON = (jsonString) => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Double-check edit permissions before submitting
    if (!canEdit()) {
      setError("You don't have permission to edit this configuration");
      return;
    }

    // Validate required fields
    if (!formData.name || !formData.name.trim()) {
      setError("Configuration name is required");
      return;
    }

    if (!formData.type) {
      setError("Configuration type is required");
      return;
    }

    // Skip JSON validation for product creation (uses component selector) or child creation (starts empty)
    if (
      !showRename &&
      !isCreatingChild &&
      !(isCreatingProduct && formData.type === "PRODUCT")
    ) {
      if (!validateJSON(formData.data)) {
        setError("Invalid JSON data");
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      if (showRename) {
        // Handle rename
        await configAPI.rename(config.id, formData.name);
      } else if (isCreating) {
        // Handle create
        let data;
        if (isCreatingChild) {
          data = {};
        } else if (isCreatingProduct && formData.type === "PRODUCT") {
          // For products, use component data instead of manual JSON
          data = computedComponentData;
        } else {
          // Parse JSON data for all other cases
          try {
            data = JSON.parse(formData.data);
          } catch (e) {
            console.error("JSON parse error:", e, "Data:", formData.data);
            setError("Invalid JSON data: " + e.message);
            setLoading(false);
            return;
          }
        }

        const createPayload = {
          name: formData.name,
          type: formData.type,
          parent_id: formData.parent_id || null,
          data,
          description: formData.description,
        };

        console.log("Creating configuration with payload:", createPayload);

        // Note: USER configurations are automatically created as DRAFT by the backend
        await configAPI.create(createPayload);
      } else {
        // Handle update
        let data;
        if (config.type === "PRODUCT" && computedComponentData && Object.keys(computedComponentData).length > 0) {
          // For products, use component data if available
          data = computedComponentData;
        } else {
          data = JSON.parse(formData.data);
        }

        await configAPI.update(config.id, {
          data,
          description: formData.description,
        });
      }

      onClose(true);
    } catch (err) {
      console.error("Failed to save configuration:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        "Failed to save configuration";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getTypeOptions = () => {
    if (isCreatingProduct) {
      return [{ value: "PRODUCT", label: "Product Configuration" }];
    }

    if (isCreatingComponent) {
      return [{ value: "COMPONENT", label: "Component Configuration" }];
    }

    if (!isCreating && !isCreatingChild) {
      // When editing, type cannot be changed
      return [
        { value: formData.type, label: `${formData.type} Configuration` },
      ];
    }

    if (user.role !== "ADMIN" && !isCreatingChild && !config) {
      return [{ value: "USER", label: "User Configuration" }];
    }

    if (!config && !isCreatingChild) {
      // Creating standalone config
      const options = [
        { value: "PRODUCT", label: "Product Configuration" },
        { value: "INSTANCE", label: "Instance Configuration" },
        { value: "USER", label: "User Configuration" },
      ];

      // Only admins can create components
      if (user.role === "ADMIN") {
        options.push({ value: "COMPONENT", label: "Component Configuration" });
      }

      return options;
    }

    // Creating child config
    if (isCreatingChild || (isCreating && config)) {
      switch (config.type) {
        case "PRODUCT":
          return [
            { value: "INSTANCE", label: "Instance Configuration" },
            { value: "USER", label: "User Configuration" },
          ];
        case "INSTANCE":
        case "USER":
          return [{ value: "USER", label: "User Configuration" }];
        case "COMPONENT":
          return [{ value: "VERSION", label: "Version Configuration" }];
        default:
          return [{ value: "USER", label: "User Configuration" }];
      }
    }

    return [{ value: "USER", label: "User Configuration" }];
  };

  const typeOptions = getTypeOptions();

  const getTitle = () => {
    if (showRename) return `Rename ${config.name}`;
    if (isCreatingProduct) return "Create New Product Configuration";
    if (isCreatingComponent) return "Create New Component Configuration";
    if (isCreating || isCreatingChild) {
      return config
        ? `Create Child Configuration for ${config.name}`
        : "Create New Configuration";
    }
    return `Edit ${config.name}`;
  };

  const getProductTemplate = () => {
    return `{
  "system": {
    "logging": {
      "level": "INFO",
      "retention_days": 30
    },
    "database": {
      "connection_pool_size": 10,
      "timeout": 5000
    }
  },
  "feature_flags": {
    "new_feature": false,
    "beta_mode": false
  },
  "business": {
    "rate_limit": 1000,
    "timeout_seconds": 30
  }
}`;
  };

  const getChildTemplate = () => {
    if (!config) return "{}";

    switch (config.type) {
      case "PRODUCT":
        return `{
  "system": {
    "logging": {
      "level": "DEBUG"
    }
  },
  "feature_flags": {
    "new_feature": true
  }
}`;
      case "INSTANCE":
      case "USER":
        return `{
  "system": {
    "logging": {
      "retention_days": 7
    }
  }
}`;
      case "COMPONENT":
        return `{
  "version": "1.0.0",
  "api": {
    "endpoint": "/api/component",
    "timeout": 5000
  },
  "settings": {
    "enabled": true
  }
}`;
      default:
        return "{}";
    }
  };

  const handleFolderImport = async () => {
    setIsImporting(true);
    try {
      // Create file input for directory selection
      // Expected folder structure example:
      // MyComponent/
      //   ├── config.json
      //   ├── icon.png
      //   ├── settings/
      //   │   ├── database.json
      //   │   └── logo.svg
      //   └── features/
      //       ├── auth.json
      //       └── payment.pdf
      // Results in: {
      //   "config": {...},
      //   "icon": { _type: "file", _link: "...", _metadata: {...} },
      //   "settings": {
      //     "database": {...},
      //     "logo": { _type: "file", _link: "...", _metadata: {...} }
      //   },
      //   "features": { "auth": {...}, "payment": { _type: "file", _link: "...", _metadata: {...} } }
      // }

      const dirInput = document.createElement('input');
      dirInput.type = 'file';
      dirInput.webkitdirectory = true;
      dirInput.multiple = true;
      // Accept all file types now (not just JSON)
      dirInput.accept = '*/*';

      const files = await new Promise((resolve, reject) => {
        dirInput.onchange = (e) => resolve(Array.from(e.target.files));
        dirInput.oncancel = () => resolve(null);
        dirInput.click();
      });

      if (!files || files.length === 0) {
        setIsImporting(false);
        return;
      }

      // Get root folder name from the first file
      const rootFolderName = files[0].webkitRelativePath.split('/')[0];

      // Use the new folder import API
      const formData = new FormData();
      formData.append('folderName', rootFolderName);

      // Add all files to form data with their relative paths as original names
      files.forEach(file => {
        // Set the originalname to the relative path for proper folder structure
        const fileWithPath = new File([file], file.webkitRelativePath, {
          type: file.type,
          lastModified: file.lastModified
        });
        formData.append('files', fileWithPath);
      });

      // Send to new folder import endpoint
      const response = await configAPI.importFolder(formData);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Import failed');
      }

      const { data: structure, stats } = response.data;

      // Check if we have any valid data
      if (!structure || Object.keys(structure).length === 0) {
        showToast('No valid files could be imported.', 'error');
        setIsImporting(false);
        return;
      }

      // Set the imported data and configuration name if empty
      setFormData(prev => ({
        ...prev,
        name: prev.name && prev.name.trim() ? prev.name : rootFolderName,
        data: JSON.stringify(structure, null, 2)
      }));

      let message = `Successfully imported ${stats.totalFiles} files (${stats.jsonFiles} JSON, ${stats.binaryFiles} binary)`;
      if (stats.errors > 0) {
        message += ` (${stats.errors} files had errors)`;
      }
      showToast(message, stats.errors > 0 ? 'warning' : 'success');

      if (stats.errors > 0) {
        console.warn('Import errors:', stats.errorDetails);
      }

    } catch (error) {
      console.error('Import error:', error);
      showToast('Failed to import folder structure', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const buildFolderStructure = async (jsonFiles) => {
    const structure = {};
    const errors = [];

    for (const file of jsonFiles) {
      try {
        const fileContent = await readFileAsText(file);
        const jsonContent = JSON.parse(fileContent);

        // Get the relative path from the file's webkitRelativePath
        const pathParts = file.webkitRelativePath.split('/');

        // Remove the first part (root folder name) to start from the content
        const relativeParts = pathParts.slice(1);

        // Skip if no relative parts (shouldn't happen with webkitdirectory)
        if (relativeParts.length === 0) {
          continue;
        }

        // Build nested structure
        let currentLevel = structure;

        // Process folders
        for (let i = 0; i < relativeParts.length - 1; i++) {
          const folderName = relativeParts[i];
          if (!currentLevel[folderName]) {
            currentLevel[folderName] = {};
          }
          currentLevel = currentLevel[folderName];
        }

        // Add the file (remove .json extension from name)
        const fileName = relativeParts[relativeParts.length - 1];
        const fileNameWithoutExt = fileName.replace(/\.json$/i, '');

        // Validate that the file name is not empty after removing extension
        if (!fileNameWithoutExt) {
          errors.push({ file: file.name, error: 'Invalid filename' });
          continue;
        }

        currentLevel[fileNameWithoutExt] = jsonContent;

      } catch (error) {
        errors.push({ file: file.name, error: error.message });
        console.warn(`Failed to parse ${file.name}:`, error);
      }
    }

    return { structure, errors };
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const isEmptyComponent = () => {
    // Allow import for creating components or editing existing COMPONENT type configurations
    if (!isCreatingComponent && !(formData.type === "COMPONENT" && !isCreating && !isCreatingChild)) {
      return false;
    }

    try {
      const parsedData = JSON.parse(formData.data || '{}');
      return Object.keys(parsedData).length === 0;
    } catch {
      // If data is not valid JSON, consider it empty
      return !formData.data || formData.data.trim() === '' || formData.data.trim() === '{}';
    }
  };

  const getEditingHelp = () => {
    if (isCreatingProduct) {
      return "As a Product configuration, you can define any new properties.";
    }

    if (isCreatingComponent) {
      return "As a Component configuration, you can define reusable properties that can be added to Products. You can also import a folder structure with JSON files to quickly build your component.";
    }

    if (!isCreating && !isCreatingChild && config) {
      // EDITING existing configuration
      switch (config.type) {
        case "PRODUCT":
          return "You are editing the base Product configuration. Changes will affect all derived configurations.";
        case "INSTANCE":
          return "You are editing Instance-level overrides. Only include properties you want to override from the Product configuration.";
        case "USER":
          return "You are editing User-level overrides. Only include properties you want to override from parent configurations.";
        case "COMPONENT":
          return "You are editing a Component configuration. This defines a reusable component that can be added to Products. If the component is empty, you can import a folder structure with JSON files.";
        case "VERSION":
          return "You are editing a Version configuration. This is a specific version of a component.";
        default:
          return "";
      }
    }

    if ((isCreating || isCreatingChild) && config) {
      // CREATING child configuration
      switch (config.type) {
        case "PRODUCT":
          return "Creating an Instance configuration. Define overrides for the selected Product configuration. Start with {} to inherit everything, or add specific overrides.";
        case "INSTANCE":
          return "Creating a User configuration. Define personal overrides for the selected Instance configuration. Start with {} to inherit everything, or add specific overrides.";
        case "USER":
          return "Creating a User configuration. Define personal overrides for the selected User configuration. Start with {} to inherit everything, or add specific overrides.";
        case "COMPONENT":
          return "Creating a Version configuration. Define the configuration for this version of the component.";
        default:
          return "";
      }
    }

    return "";
  };

  const getParentDisplayInfo = () => {
    if ((isCreating || isCreatingChild) && config && !isCreatingProduct) {
      // Creating child - show the parent (which is the selected config)
      return {
        name: config.name,
        type: config.type,
      };
    } else if (
      !isCreating &&
      !isCreatingChild &&
      config &&
      config.parent_name
    ) {
      // Editing existing - show the actual parent
      return {
        name: config.parent_name,
        type: config.parent_type,
      };
    }
    return null;
  };

  const parentInfo = getParentDisplayInfo();

  if (!canEdit()) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full transition-colors">
          <div className="p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <XMarkIcon className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Cannot Edit Configuration
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {config.status === "COMMITTED"
                  ? "This user configuration has been committed and cannot be edited."
                  : "You don't have permission to edit this configuration."}
              </p>
              <button onClick={() => onClose(false)} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadingRawData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 animate-spin border-2 border-gray-300 border-t-primary-600 rounded-full"></div>
            <span>Loading configuration data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-hidden transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{getTitle()}</h2>
          <div className="flex items-center space-x-2">
            {config &&
              !isCreating &&
              !isCreatingChild &&
              user.role === "ADMIN" &&
              !showRename && (
                <button
                  onClick={() => setShowRename(true)}
                  className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  Rename
                </button>
              )}
            {showRename && (
              <button
                onClick={() => setShowRename(false)}
                className="text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Cancel Rename
              </button>
            )}
            <button
              onClick={() => onClose(false)}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-96">
          <div className="flex-1 p-6 space-y-4 overflow-auto">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded transition-colors">
                {error}
              </div>
            )}

            {/* Editing Help */}
            {!showRename && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-4 py-3 rounded text-sm transition-colors">
                ℹ️ {getEditingHelp()}
              </div>
            )}

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Configuration Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                disabled={!isCreating && !isCreatingChild && !showRename}
                className="mt-1 input-field w-full disabled:bg-gray-50 dark:disabled:bg-gray-700 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={
                  isCreatingProduct
                    ? "e.g., prod_analytics, prod_ecommerce"
                    : "e.g., inst_staging_eu, user_dev_john_v2"
                }
              />
              {showRename && (
                <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                  ⚠️ Renaming will affect all references to this configuration
                </p>
              )}
            </div>

            {!showRename && (
              <>
                {/* Type */}
                <div>
                  <label
                    htmlFor="type"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                  >
                    Configuration Type
                  </label>
                  <select
                    id="type"
                    name="type"
                    disabled={
                      (!isCreating && !isCreatingChild) ||
                      typeOptions.length === 1
                    }
                    className="mt-1 input-field w-full disabled:bg-gray-50 dark:disabled:bg-gray-700 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                    value={formData.type}
                    onChange={handleInputChange}
                  >
                    {typeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {!isCreating && !isCreatingChild && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Configuration type cannot be changed when editing.
                    </p>
                  )}
                </div>

                {/* Parent (shown for context) */}
                {parentInfo && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      {isCreating
                        ? "Parent Configuration"
                        : "Parent Configuration"}
                    </label>
                    <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg transition-colors">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            parentInfo.type === "PRODUCT"
                              ? "bg-blue-100 text-blue-800"
                              : parentInfo.type === "INSTANCE"
                                ? "bg-green-100 text-green-800"
                                : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {parentInfo.type}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {parentInfo.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="mt-1 input-field w-full dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe the purpose of this configuration..."
                  />
                </div>

                {/* Component Selector for Product Creation and Editing */}
                {(isCreatingProduct || (!isCreatingChild && config?.type === "PRODUCT")) && formData.type === "PRODUCT" && (
                  <ComponentSelector
                    selectedComponents={selectedComponents}
                    onComponentsChange={setSelectedComponents}
                    onDataChange={setComputedComponentData}
                  />
                )}

                {/* JSON Data - Hide for child creation and product creation */}
                {!isCreatingChild &&
                  !(isCreatingProduct && formData.type === "PRODUCT") && (
                    <div>
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="data"
                          className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                        >
                          Configuration Data (JSON)
                          {!isCreating &&
                            !isCreatingChild &&
                            !isCreatingProduct &&
                            formData.type !== "PRODUCT" &&
                            " - Level-Specific Overrides Only"}
                        </label>
                        <div className="flex space-x-2">
                          {(isCreatingComponent || (!isCreating && !isCreatingChild && formData.type === "COMPONENT")) && isEmptyComponent() && (
                            <button
                              type="button"
                              onClick={handleFolderImport}
                              disabled={isImporting}
                              className="flex items-center space-x-1 text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 disabled:opacity-50"
                              title="Import folder structure with JSON files. Folder names become object keys, JSON files become nested objects."
                            >
                              <FolderArrowDownIcon className="w-3 h-3" />
                              <span>{isImporting ? 'Importing...' : 'Import Folder'}</span>
                            </button>
                          )}
                          {isCreatingProduct && (
                            <button
                              type="button"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  data: getProductTemplate(),
                                }))
                              }
                              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                            >
                              Use Template
                            </button>
                          )}
                          {(isCreating || isCreatingChild) &&
                            config &&
                            !isCreatingProduct && (
                              <button
                                type="button"
                                onClick={() =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    data: getChildTemplate(),
                                  }))
                                }
                                className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                              >
                                Use Example
                              </button>
                            )}
                        </div>
                      </div>
                      <textarea
                        id="data"
                        name="data"
                        rows={16}
                        required
                        className="mt-1 input-field w-full font-mono text-sm dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600"
                        value={formData.data}
                        onChange={handleInputChange}
                        placeholder={
                          isCreatingProduct
                            ? "Define your product configuration schema..."
                            : isCreating || isCreatingChild
                              ? "{}\n\n# Start with empty object to inherit everything from parent,\n# or add specific properties to override"
                              : '{\n  "property": "value"\n}'
                        }
                      />
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {!isCreating &&
                          !isCreatingChild &&
                          !isCreatingProduct &&
                          formData.type !== "PRODUCT" && (
                            <>
                              📝 This shows only the properties defined at this
                              configuration level. Empty object {} means inherit
                              everything from parent.
                            </>
                          )}
                        {!isCreating &&
                          !isCreatingChild &&
                          formData.type === "PRODUCT" && (
                            <>
                              🔧 This is the base Product configuration. Changes
                              here affect all derived configurations.
                            </>
                          )}
                        {(isCreating || isCreatingChild) &&
                          formData.parent_id &&
                          !isCreatingProduct && (
                            <>
                              ⚠️ Only properties that exist in the parent
                              configuration are allowed. Use {} to inherit
                              everything, or specify overrides.
                            </>
                          )}
                        {isCreatingProduct && (
                          <>
                            ✅ As a Product configuration, you can define any
                            new properties.
                          </>
                        )}
                      </div>
                    </div>
                  )}

                {/* Child creation message */}
                {isCreatingChild && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 px-4 py-3 rounded text-sm transition-colors">
                    📝 The child configuration will inherit all data from the
                    parent. You can customize it using inline editing after
                    creation.
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 transition-colors">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : showRename
                  ? "Rename Configuration"
                  : isCreating
                    ? "Create Configuration"
                    : "Update Configuration"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ConfigurationEditor;
