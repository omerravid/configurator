import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { configAPI } from "../services/api";
import { XMarkIcon } from "@heroicons/react/24/outline";

const ConfigurationEditor = ({ config, onClose }) => {
  const { user } = useAuth();
  const [isCreating, setIsCreating] = useState(!config);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    type: "USER",
    parent_id: config?.id || "",
    description: "",
    data: "{}",
  });

  useEffect(() => {
    if (config && !isCreating) {
      // Editing existing config - load current data
      setFormData({
        name: config.name,
        type: config.type,
        parent_id: config.parent_id || "",
        description: config.description || "",
        data: JSON.stringify(config.data || {}, null, 2),
      });
    } else if (config) {
      // Creating child config
      setFormData((prev) => ({
        ...prev,
        parent_id: config.id,
        type: config.type === "PRODUCT" ? "INSTANCE" : "USER",
      }));
    }
  }, [config, isCreating]);

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

    if (!validateJSON(formData.data)) {
      setError("Invalid JSON data");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = JSON.parse(formData.data);

      if (isCreating) {
        await configAPI.create({
          name: formData.name,
          type: formData.type,
          parent_id: formData.parent_id || null,
          data,
          description: formData.description,
        });
      } else {
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
    if (user.role !== "ADMIN") {
      return [{ value: "USER", label: "User Configuration" }];
    }

    if (!config) {
      return [
        { value: "PRODUCT", label: "Product Configuration" },
        { value: "INSTANCE", label: "Instance Configuration" },
        { value: "USER", label: "User Configuration" },
      ];
    }

    // Creating child config
    switch (config.type) {
      case "PRODUCT":
        return [{ value: "INSTANCE", label: "Instance Configuration" }];
      case "INSTANCE":
        return [{ value: "USER", label: "User Configuration" }];
      case "USER":
        return [{ value: "USER", label: "User Configuration" }];
      default:
        return [{ value: "USER", label: "User Configuration" }];
    }
  };

  const typeOptions = getTypeOptions();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-screen overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isCreating
              ? config
                ? `Create Child Configuration for ${config.name}`
                : "Create New Configuration"
              : `Edit ${config.name}`}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col h-full max-h-96">
          <div className="flex-1 p-6 space-y-4 overflow-auto">
            {error && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded">
                {error}
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
                disabled={!isCreating}
                className="mt-1 input-field w-full disabled:bg-gray-50"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="e.g., prod_analytics, user_dev_john_v2"
              />
            </div>

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
                disabled={!isCreating || typeOptions.length === 1}
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
            </div>

            {/* Parent (shown for context) */}
            {formData.parent_id && config && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Parent Configuration
                </label>
                <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        config.type === "PRODUCT"
                          ? "bg-blue-100 text-blue-800"
                          : config.type === "INSTANCE"
                            ? "bg-green-100 text-green-800"
                            : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {config.type}
                    </span>
                    <span className="text-sm font-medium">{config.name}</span>
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
              <label
                htmlFor="data"
                className="block text-sm font-medium text-gray-700"
              >
                Configuration Data (JSON)
              </label>
              <textarea
                id="data"
                name="data"
                rows={12}
                required
                className="mt-1 input-field w-full font-mono text-sm"
                value={formData.data}
                onChange={handleInputChange}
                placeholder='{\n  "system": {\n    "logging": {\n      "level": "INFO"\n    }\n  }\n}'
              />
              <div className="mt-1 text-xs text-gray-500">
                {isCreating && formData.parent_id && (
                  <>
                    ⚠️ Only properties that exist in the parent configuration
                    are allowed.
                  </>
                )}
              </div>
            </div>
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
