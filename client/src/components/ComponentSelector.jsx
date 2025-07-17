import React, { useState, useEffect } from "react";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { configAPI } from "../services/api";

const ComponentSelector = ({ selectedComponents, onComponentsChange }) => {
  const [availableComponents, setAvailableComponents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComponents();
  }, []);

  const loadComponents = async () => {
    try {
      const response = await configAPI.getComponents();
      setAvailableComponents(response.data.components);
    } catch (error) {
      console.error("Failed to load components:", error);
    } finally {
      setLoading(false);
    }
  };

  const addComponent = () => {
    const newComponent = {
      id: Date.now(), // temporary ID for the component selection
      componentId: "",
      versionId: "",
      componentName: "",
      versionName: "",
    };
    onComponentsChange([...selectedComponents, newComponent]);
  };

  const removeComponent = (index) => {
    const updated = selectedComponents.filter((_, i) => i !== index);
    onComponentsChange(updated);
  };

  const updateComponent = (index, field, value) => {
    const updated = [...selectedComponents];
    updated[index] = { ...updated[index], [field]: value };

    // If component changed, reset version selection
    if (field === "componentId") {
      const component = availableComponents.find((c) => c.id === value);
      updated[index].componentName = component?.name || "";
      updated[index].versionId = "";
      updated[index].versionName = "";
    } else if (field === "versionId") {
      const component = availableComponents.find(
        (c) => c.id === updated[index].componentId,
      );
      const version = component?.versions.find((v) => v.id === value);
      updated[index].versionName = version?.name || "";
    }

    onComponentsChange(updated);
  };

  const getSelectedComponentData = () => {
    const componentData = {};

    selectedComponents.forEach((item) => {
      if (item.componentId && item.versionId) {
        const component = availableComponents.find(
          (c) => c.id === item.componentId,
        );
        const version = component?.versions.find(
          (v) => v.id === item.versionId,
        );

        if (component && version) {
          componentData[component.name] = version.data || {};
        }
      }
    });

    return componentData;
  };

  // Expose the data through a callback
  React.useEffect(() => {
    if (onComponentsChange.getComputedData) {
      onComponentsChange.getComputedData(getSelectedComponentData());
    }
  }, [selectedComponents, availableComponents]);

  if (loading) {
    return <div className="text-center py-4">Loading components...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">
          Product Components
        </h3>
        <button
          type="button"
          onClick={addComponent}
          className="btn-secondary flex items-center space-x-1"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add Component</span>
        </button>
      </div>

      {selectedComponents.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No components selected. Add components to define this product's
          structure.
        </div>
      )}

      {selectedComponents.map((item, index) => (
        <div
          key={item.id}
          className="border border-gray-200 rounded-lg p-4 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-700">Component {index + 1}</h4>
            <button
              type="button"
              onClick={() => removeComponent(index)}
              className="text-red-600 hover:text-red-700"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Component Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Component
              </label>
              <select
                value={item.componentId}
                onChange={(e) =>
                  updateComponent(index, "componentId", e.target.value)
                }
                className="input-field w-full"
              >
                <option value="">Select a component...</option>
                {availableComponents.map((component) => (
                  <option key={component.id} value={component.id}>
                    {component.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Version Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Version
              </label>
              <select
                value={item.versionId}
                onChange={(e) =>
                  updateComponent(index, "versionId", e.target.value)
                }
                className="input-field w-full"
                disabled={!item.componentId}
              >
                <option value="">Select a version...</option>
                {item.componentId &&
                  availableComponents
                    .find((c) => c.id === item.componentId)
                    ?.versions.map((version) => (
                      <option key={version.id} value={version.id}>
                        {version.name} ({version.status})
                      </option>
                    ))}
              </select>
            </div>
          </div>

          {item.componentName && item.versionName && (
            <div className="bg-gray-50 p-3 rounded text-sm">
              <strong>Selected:</strong> {item.componentName} →{" "}
              {item.versionName}
            </div>
          )}
        </div>
      ))}

      {selectedComponents.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">
            Computed Product Structure
          </h4>
          <pre className="text-sm text-blue-700 overflow-auto max-h-32">
            {JSON.stringify(getSelectedComponentData(), null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ComponentSelector;
