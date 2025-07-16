import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { configAPI } from "../services/api";
import { XMarkIcon } from "@heroicons/react/24/outline";

const ConfigurationEditor = ({
  config,
  onClose,
  isCreatingProduct = false,
  isRenaming = false,
  isCreatingChild = false,
}) => {
  const { user } = useAuth();
  // Determine if we're creating a new config or editing an existing one
  const [isCreating, setIsCreating] = useState(
    isCreatingProduct || isCreatingChild || !config,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRename, setShowRename] = useState(isRenaming);
  const [loadingRawData, setLoadingRawData] = useState(false);

  // Check if user can edit this configuration
  const canEdit = () => {
    if (isCreating || isCreatingChild || isCreatingProduct || showRename)
      return true;
    if (!config) return true;
    if (user.role === "ADMIN") return true;
    return (
      config.type === "USER" &&
      config.created_by === user.id &&
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
          type: config.type === "PRODUCT" ? "INSTANCE" : "USER", // Determine child type
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
      }
    };

    loadRawConfigData();
  }, [config, isCreating, isCreatingProduct, isCreatingChild]);

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

    if (!showRename && !validateJSON(formData.data)) {
      setError("Invalid JSON data");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (showRename) {
        // Handle rename
        await configAPI.rename(config.id, formData.name);
      } else if (isCreating) {
        // Handle create
        const data = JSON.parse(formData.data);
        await configAPI.create({
          name: formData.name,
          type: formData.type,
          parent_id: formData.parent_id || null,
          data,
          description: formData.description,
        });
      } else {
        // Handle update
        const data = JSON.parse(formData.data);
        await configAPI.update(config.id, {
          data,
          description: formData.description,
        });
      }

      onClose(true);
    } catch (err) {
      console.error("Failed to save configuration:", err);
      setError(err.response?.data?.error || "Failed to save configuration");
    } finally {
      setLoading(false);
    }
  };

  const getTypeOptions = () => {
    if (isCreatingProduct) {
      return [{ value: "PRODUCT", label: "Product Configuration" }];
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
      return [
        { value: "PRODUCT", label: "Product Configuration" },
        { value: "INSTANCE", label: "Instance Configuration" },
        { value: "USER", label: "User Configuration" },
      ];
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
      default:
        return "{}";
    }
  };

  const getEditingHelp = () => {
    if (isCreatingProduct) {
      return "As a Product configuration, you can define any new properties.";
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
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
          <div className="p-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <XMarkIcon className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Cannot Edit Configuration
              </h3>
              <p className="text-gray-600 mb-4">
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
        <div className="bg-white rounded-lg shadow-xl p-6">
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
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{getTitle()}</h2>
          <div className="flex items-center space-x-2">
            {config &&
              !isCreating &&
              !isCreatingChild &&
              user.role === "ADMIN" &&
              !showRename && (
                <button
                  onClick={() => setShowRename(true)}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Rename
                </button>
              )}
            {showRename && (
              <button
                onClick={() => setShowRename(false)}
                className="text-sm text-gray-600 hover:text-gray-700"
              >
                Cancel Rename
              </button>
            )}
            <button
              onClick={() => onClose(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-96">
          <div className="flex-1 p-6 space-y-4 overflow-auto">
            {error && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Editing Help */}
            {!showRename && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
                ℹ️ {getEditingHelp()}
              </div>
            )}

            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-gray-700"
              >
                Configuration Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                disabled={!isCreating && !isCreatingChild && !showRename}
                className="mt-1 input-field w-full disabled:bg-gray-50"
                value={formData.name}
                onChange={handleInputChange}
                placeholder={
                  isCreatingProduct
                    ? "e.g., prod_analytics, prod_ecommerce"
                    : "e.g., inst_staging_eu, user_dev_john_v2"
                }
              />
              {showRename && (
                <p className="mt-1 text-xs text-orange-600">
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
                    className="block text-sm font-medium text-gray-700"
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
                    className="mt-1 input-field w-full disabled:bg-gray-50"
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
                    <p className="mt-1 text-xs text-gray-500">
                      Configuration type cannot be changed when editing.
                    </p>
                  )}
                </div>

                {/* Parent (shown for context) */}
                {parentInfo && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {isCreating
                        ? "Parent Configuration"
                        : "Parent Configuration"}
                    </label>
                    <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg">
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
                        <span className="text-sm font-medium">
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
                    className="block text-sm font-medium text-gray-700"
                  >
                    Description (Optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={3}
                    className="mt-1 input-field w-full"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe the purpose of this configuration..."
                  />
                </div>

                {/* JSON Data */}
                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="data"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Configuration Data (JSON)
                      {!isCreating &&
                        !isCreatingChild &&
                        !isCreatingProduct &&
                        formData.type !== "PRODUCT" &&
                        " - Level-Specific Overrides Only"}
                    </label>
                    <div className="flex space-x-2">
                      {isCreatingProduct && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              data: getProductTemplate(),
                            }))
                          }
                          className="text-xs text-primary-600 hover:text-primary-700"
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
                            className="text-xs text-primary-600 hover:text-primary-700"
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
                    className="mt-1 input-field w-full font-mono text-sm"
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
                  <div className="mt-1 text-xs text-gray-500">
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
                        ✅ As a Product configuration, you can define any new
                        properties.
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
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
