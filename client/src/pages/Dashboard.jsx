import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ConfigurationTree from "../components/ConfigurationTree";
import InteractiveJSONViewer from "../components/InteractiveJSONViewer";
import ConfigurationEditor from "../components/ConfigurationEditor";
import PathQueryPanel from "../components/PathQueryPanel";
import ContextMenu from "../components/ContextMenu";
import HelpModal from "../components/HelpModal";
import SettingsModal from "../components/SettingsModal";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";
import { useToast } from "../context/ToastContext";
import { configAPI } from "../services/api";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  UserIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  EllipsisVerticalIcon,
  QuestionMarkCircleIcon,
  AdjustmentsHorizontalIcon,
} from "@heroicons/react/24/outline";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [resolvedData, setResolvedData] = useState(null);
  const [allConfigurations, setAllConfigurations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateComponent, setShowCreateComponent] = useState(false);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);


  const loadAllConfigurations = async () => {
    try {
      const response = await configAPI.getAll();
      setAllConfigurations(response.data.configs || []);
    } catch (err) {
      console.error("Failed to load all configurations:", err);
      // Don't show error toast for empty configurations
      if (err.response?.status !== 404) {
        showToast("Failed to load configurations", "error");
      }
    }
  };

  const loadConfigurationData = async (config) => {
    if (!config) return;

    setLoading(true);
    setError(null);
    try {
      const response = await configAPI.getById(config.id, true);
      setResolvedData(response.data);
    } catch (err) {
      console.error("Failed to load configuration data:", err);
      setError("Failed to load configuration data");
    } finally {
      setLoading(false);
    }
  };

  // Load all configurations on component mount
  useEffect(() => {
    loadAllConfigurations();
  }, [refreshTrigger]);

  const handleConfigSelect = (config) => {
    console.log("=== handleConfigSelect called ===");
    console.log("config:", config);
    console.log("config.id:", config.id, typeof config.id);
    console.log("config.id stringified:", JSON.stringify(config.id));

    setSelectedConfig(config);
    setShowEditor(false);
    setShowRename(false);
    loadConfigurationData(config);
  };

  const handleCreateChild = () => {
    if (!selectedConfig) return;

    setShowCreateChild(true);
    setShowRename(false);
  };

  const handleCreateProduct = () => {
    setShowCreateProduct(true);
    setShowCreateChild(false);
    setShowRename(false);
  };

  const handleCreateComponent = () => {
    setShowCreateComponent(true);
    setShowCreateProduct(false);
    setShowCreateChild(false);
    setShowRename(false);
  };

  const handleEdit = () => {
    if (!selectedConfig) return;

    setShowEditor(true);
    setShowCreateChild(false);
    setShowRename(false);
  };

  const handleRename = () => {
    if (!selectedConfig) return;

    setShowRename(true);
    setShowEditor(false);
    setShowCreateChild(false);
  };

  const handleDuplicate = async () => {
    if (!selectedConfig) return;

    try {
      // Get the raw configuration data to duplicate
      const rawResponse = await configAPI.getRawById(selectedConfig.id);
      const sourceData = rawResponse.data.resolved || {};

      // Validate that we have valid data to duplicate
      if (
        !sourceData ||
        (typeof sourceData === "object" && Object.keys(sourceData).length === 0)
      ) {
        // For empty configurations, use an empty object
        console.log("Source configuration has no data, using empty object");
      }

      // Generate unique name with _copy suffix
      const baseName = selectedConfig.name;
      const copyName = await generateUniqueCopyName(baseName);

      // Create a safe description
      let safeDescription = `Copy of ${selectedConfig.name}`;
      if (
        selectedConfig.description &&
        typeof selectedConfig.description === "string" &&
        selectedConfig.description.length < 200 &&
        !selectedConfig.description.includes("{")
      ) {
        safeDescription = `Copy of ${selectedConfig.description}`;
      }

      // Create the duplicate configuration
      const newConfig = {
        name: copyName,
        type: selectedConfig.type,
        parent_id: selectedConfig.parent_id || null,
        data: sourceData,
        description: safeDescription,
      };

      // Note: USER configurations are automatically created as DRAFT by the backend

      const createResponse = await configAPI.create(newConfig);

      // Refresh the tree and configurations list
      setRefreshTrigger((prev) => prev + 1);
      await loadAllConfigurations();

      // Try to select the newly created configuration
      if (createResponse.data.config) {
        setSelectedConfig(createResponse.data.config);
        loadConfigurationData(createResponse.data.config);
      } else {
        // Fallback: find the configuration by name after a short delay
        setTimeout(async () => {
          try {
            const response = await configAPI.getAll();
            const newConfig = response.data.configs.find(
              (c) => c.name === copyName,
            );
            if (newConfig) {
              setSelectedConfig(newConfig);
              loadConfigurationData(newConfig);
            }
          } catch (err) {
            console.error("Failed to select newly created configuration:", err);
          }
        }, 500);
      }

      showToast(`Configuration duplicated as "${copyName}"`);
    } catch (err) {
      console.error("Failed to duplicate configuration:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        "Failed to duplicate configuration";
      showToast(`Failed to duplicate: ${errorMessage}`, "error");
    }
  };

  const generateUniqueCopyName = async (baseName) => {
    try {
      // Get all configurations to check for name conflicts
      const response = await configAPI.getAll();
      const existingNames = response.data.configs.map((c) => c.name);

      let copyName = `${baseName}_copy`;
      let counter = 1;

      // Keep incrementing until we find a unique name
      while (existingNames.includes(copyName)) {
        counter++;
        copyName = `${baseName}_copy_${counter}`;
      }

      return copyName;
    } catch (err) {
      // Fallback if we can't check existing names
      return `${baseName}_copy_${Date.now()}`;
    }
  };

  const handleCommit = async () => {
    if (
      !selectedConfig ||
      selectedConfig.type !== "USER" ||
      selectedConfig.status !== "DRAFT"
    ) {
      return;
    }

    try {
      await configAPI.commit(selectedConfig.id);
      setRefreshTrigger((prev) => prev + 1);
      // Reload the current config
      const updated = { ...selectedConfig, status: "COMMITTED" };
      setSelectedConfig(updated);
    } catch (err) {
      console.error("Failed to commit configuration:", err);
      setError("Failed to commit configuration");
    }
  };

  const handleDelete = () => {
    if (!selectedConfig) {
      return;
    }
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async (config) => {
    setShowDeleteConfirm(false);

    try {
      const response = await configAPI.delete(config.id);
      setSelectedConfig(null);
      setResolvedData(null);

      setRefreshTrigger((prev) => prev + 1);

      showToast(`Configuration "${config.name}" deleted successfully`);
    } catch (err) {
      console.error("Failed to delete configuration:", err);
      const errorMessage = err.response?.data?.error || err.message || "Failed to delete configuration";
      setError(`Failed to delete configuration: ${errorMessage}`);
      showToast(`Failed to delete: ${errorMessage}`, "error");
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  const handleArchive = async (config, archiveChildren = true) => {
    try {
      const response = await configAPI.archive(config.id, archiveChildren);
      setSelectedConfig(null);
      setResolvedData(null);
      setRefreshTrigger((prev) => prev + 1);
      showToast(`Configuration "${config.name}" archived successfully`);
    } catch (err) {
      console.error("Failed to archive configuration:", err);
      const errorMessage = err.response?.data?.error || err.message || "Failed to archive configuration";
      setError(`Failed to archive configuration: ${errorMessage}`);
      showToast(`Failed to archive: ${errorMessage}`, "error");
    }
  };

  const handleRestore = async (config) => {
    try {
      const response = await configAPI.restore(config.id);
      setSelectedConfig(null);
      setResolvedData(null);

      setRefreshTrigger((prev) => prev + 1);

      showToast(`Configuration "${config.name}" restored successfully`);
    } catch (err) {
      console.error("Failed to restore configuration:", err);
      const errorMessage = err.response?.data?.error || err.message || "Failed to restore configuration";
      setError(`Failed to restore configuration: ${errorMessage}`, "error");
    }
  };

  const handleEditorClose = (success) => {
    setShowEditor(false);
    setShowCreateProduct(false);
    setShowCreateComponent(false);
    setShowCreateChild(false);
    setShowRename(false);
    if (success) {
      setRefreshTrigger((prev) => prev + 1);
      // Reload current config if it was edited
      if (selectedConfig) {
        loadConfigurationData(selectedConfig);
      }
    }
  };

  const handleDataChange = async (path, newValue) => {
    if (!selectedConfig || !canEdit()) return;

    try {
      console.log("=== handleDataChange - INHERITANCE DEBUG ===");
      console.log("SELECTED CONFIG (what will be updated):");
      console.log("  - Name:", selectedConfig.name);
      console.log("  - Type:", selectedConfig.type);
      console.log("  - ID:", selectedConfig.id);
      console.log("PATH BEING EDITED:", path);
      console.log("NEW VALUE:", newValue);
      console.log("INHERITANCE EXPECTATION:");
      console.log("  - If editing COMPONENT: should modify component directly");
      console.log("  - If editing INSTANCE: should create override in instance");
      console.log("  - If editing USER: should create override in user config");

      // Ensure selectedConfig.id is a string
      const configId = typeof selectedConfig.id === 'string' ? selectedConfig.id : String(selectedConfig.id);
      console.log("configId after string conversion:", configId);

      // For component removal in products, we need the resolved data to see all components
      // For other edits, use raw data to preserve inheritance
      let currentData;
      if (selectedConfig.type === "PRODUCT" && selectedPath && newValue === undefined) {
        // Component removal: use resolved data to see all current components
        const resolvedResponse = await configAPI.getById(configId, true);
        currentData = resolvedResponse.data.resolved || {};
      } else {
        // Normal property edits: use raw data to preserve inheritance
        const rawResponse = await configAPI.getRawById(configId);
        currentData = rawResponse.data.data || {};
      }

      // Special case: if path is "_root_", replace the entire data object
      if (path === "_root_") {
        // Update the configuration with the new root data
        await configAPI.update(configId, { data: newValue });

        // Reload data
        const response = await configAPI.getById(configId, true);
        setResolvedData(response.data);
        showToast("Configuration updated successfully");
        return;
      }

      // For child configurations, validate the path exists in parent
      // Note: INSTANCE configurations should be allowed to override component properties more freely
      if (selectedConfig.type !== "PRODUCT" && selectedConfig.type !== "INSTANCE" && selectedConfig.parent_id) {
        console.log("Performing path validation for non-PRODUCT, non-INSTANCE configuration");
        try {
          // Ensure parent_id is a string
          const parentId = typeof selectedConfig.parent_id === 'string' ? selectedConfig.parent_id : String(selectedConfig.parent_id);

          // Check if the path exists in the resolved parent configuration
          const resolvedParent = await configAPI.getById(
            parentId,
            true,
          );
          const parentResolved = resolvedParent.data.resolved || {};

          // Check if path exists in parent by traversing the path
          // Remove "root." prefix if present for validation
          const cleanPath = path.startsWith("root.") ? path.substring(5) : path;
          const pathParts = cleanPath.split(".");
          let checkCurrent = parentResolved;
          let pathExists = true;

          for (const part of pathParts) {
            if (
              checkCurrent &&
              typeof checkCurrent === "object" &&
              checkCurrent.hasOwnProperty(part)
            ) {
              checkCurrent = checkCurrent[part];
            } else {
              pathExists = false;
              break;
            }
          }

          if (!pathExists) {
            throw new Error(
              `Property '${path}' cannot be added. It doesn't exist in the parent configuration. Child configurations can only override existing properties.`,
            );
          }
        } catch (pathCheckError) {
          console.error("Path validation error:", pathCheckError);
          throw pathCheckError;
        }
      } else if (selectedConfig.type === "INSTANCE") {
        console.log("Skipping path validation for INSTANCE - allowing component override");
      }

      // Remove "root." prefix if present
      const cleanPath = path.startsWith("root.") ? path.substring(5) : path;
      console.log("Original path:", path, "Clean path:", cleanPath);

      const pathParts = cleanPath.split(".");
      const newData = JSON.parse(JSON.stringify(currentData)); // Deep clone

      // Navigate to the parent of the target property
      let current = newData;
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }

      // Set the new value or delete if undefined
      const lastKey = pathParts[pathParts.length - 1];
      if (newValue === undefined) {
        delete current[lastKey];
      } else {
        current[lastKey] = newValue;
      }

      // Update the configuration with only the modified data
      await configAPI.update(configId, { data: newData });

      // Optimized update: only reload data without refreshing the tree
      // This preserves expand/collapse states and focus
      try {
        const response = await configAPI.getById(configId, true);
        setResolvedData(response.data);

        // Don't refresh tree for simple value updates
        // Tree refresh is only needed for structural changes (name, type, parent changes)
        // Since we're only updating data values here, no tree refresh needed

        // Show success toast
        showToast(`Updated ${path} successfully`);
      } catch (reloadError) {
        console.warn("Failed to reload configuration data:", reloadError);
        // Fallback to full reload if optimized update fails
        await loadConfigurationData(selectedConfig);
        showToast(`Updated ${path} successfully`);
      }
    } catch (err) {
      console.error("Failed to update configuration:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        "Failed to update configuration";
      setError(`Failed to update configuration: ${errorMessage}`);
      showToast(`Failed to update: ${errorMessage}`, "error");
    }
  };

  // Handle adding component to product via drag and drop
  const handleAddComponent = async (productId, componentData) => {
    try {
      // Get the current product configuration
      const productResponse = await configAPI.getRawById(productId);
      const currentData = productResponse.data.resolved || {};

      // Add the component directly as a top-level property
      const updatedData = { ...currentData };

      let componentToAdd = null;
      let componentKey = "";

      if (componentData.type === "COMPONENT") {
        // When dragging a component, add it with its root/default version (the component itself)
        componentKey = componentData.name;

        // Check if this component is already added
        if (updatedData[componentKey]) {
          showToast(`${componentData.name} is already added to this product`, "warning");
          return;
        }

        componentToAdd = {
          componentId: componentData.id,
          versionId: componentData.id, // Use component itself as the root version
          componentName: componentData.name,
          versionName: `${componentData.name} (root)`
        };

      } else if (componentData.type === "VERSION") {
        // When dragging a version, add the component with that specific version
        const versionResponse = await configAPI.getById(componentData.id);
        const versionConfig = versionResponse.data;

        const componentName = versionConfig.parent_name || "Unknown Component";
        componentKey = componentName;

        // Check if this component is already added
        if (updatedData[componentKey]) {
          showToast(`${componentName} is already added to this product`, "warning");
          return;
        }

        componentToAdd = {
          componentId: versionConfig.parent_id,
          versionId: componentData.id,
          componentName: componentName,
          versionName: `${componentName} (${componentData.name})`
        };
      }

      if (!componentToAdd || !componentKey) {
        showToast("Failed to determine component details", "error");
        return;
      }

      // Add the component as a direct property with component name as key
      updatedData[componentKey] = componentToAdd;

      // Update the product configuration
      await configAPI.update(productId, { data: updatedData });

      showToast(`Added ${componentToAdd.componentName} (${componentToAdd.versionName}) to product successfully`);

      // Refresh the selected configuration if it's the product we just updated
      if (selectedConfig && selectedConfig.id === productId) {
        await loadConfigurationData(selectedConfig);
      }

      // Trigger a refresh of the tree
      setRefreshTrigger(prev => prev + 1);

    } catch (error) {
      console.error("Failed to add component:", error);
      showToast("Failed to add component to product", "error");
    }
  };

  // Context menu handlers for tree items
  const handleTreeEdit = (config) => {
    setSelectedConfig(config);
    handleEdit();
  };

  const handleTreeRename = (config) => {
    setSelectedConfig(config);
    handleRename();
  };

  const handleTreeDuplicate = (config) => {
    setSelectedConfig(config);
    handleDuplicate();
  };

  const handleTreeCreateChild = (config) => {
    setSelectedConfig(config);
    handleCreateChild();
  };

  const handleTreeCommit = (config) => {
    setSelectedConfig(config);
    handleCommit();
  };

  const handleTreeDelete = (config) => {
    setSelectedConfig(config);
    handleDelete();
  };

  const handleTreeArchive = (config) => {
    handleArchive(config);
  };

  const handleTreeRestore = (config) => {
    handleRestore(config);
  };

  const handleContextMenuShow = (e) => {
    e.preventDefault();
    if (!selectedConfig) return;

    const menuItems = [
      {
        label: `Edit ${selectedConfig.type.toLowerCase()} configuration`,
        icon: PencilIcon,
        onClick: handleEdit,
        disabled: !canEdit(),
      },
      {
        label: `Rename "${selectedConfig.name}"`,
        icon: DocumentTextIcon,
        onClick: handleRename,
        disabled: !canRename(),
      },
      {
        label: `Duplicate as sibling`,
        icon: DocumentDuplicateIcon,
        onClick: handleDuplicate,
      },
      {
        label: `Create child configuration`,
        icon: PlusIcon,
        onClick: handleCreateChild,
        disabled: !canCreateChild(),
      },
    ];

    if (canCommit()) {
      menuItems.push({
        label: "Commit configuration",
        icon: CheckIcon,
        onClick: handleCommit,
      });
    }

    if (canArchive()) {
      menuItems.push({
        label: `Archive "${selectedConfig.name}"`,
        icon: TrashIcon,
        onClick: () => handleTreeArchive(selectedConfig),
      });
    }

    if (canRestore()) {
      menuItems.push({
        label: `Restore "${selectedConfig.name}"`,
        icon: CheckIcon,
        onClick: () => handleTreeRestore(selectedConfig),
      });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: menuItems,
    });
  };

  const canEdit = () => {
    if (!selectedConfig || Boolean(selectedConfig.archived)) return false;
    if (user.role === "ADMIN") return true;
    return (
      selectedConfig.type === "USER" &&
      selectedConfig.created_by === user.id &&
      selectedConfig.status === "DRAFT"
    );
  };

  const canRename = () => {
    return selectedConfig && !Boolean(selectedConfig.archived) && user.role === "ADMIN";
  };

  const canDelete = () => {
    return selectedConfig && !Boolean(selectedConfig.archived) && user.role === "ADMIN";
  };

  const canArchive = () => {
    return selectedConfig && !Boolean(selectedConfig.archived) && user.role === "ADMIN";
  };

  const canRestore = () => {
    return selectedConfig && Boolean(selectedConfig.archived) && user.role === "ADMIN";
  };

  const canCommit = () => {
    if (!selectedConfig || Boolean(selectedConfig.archived)) return false;
    if (selectedConfig.type !== "USER" && selectedConfig.type !== "VERSION") return false;
    if (selectedConfig.status !== "DRAFT") return false;
    return user.role === "ADMIN" || selectedConfig.created_by === user.id;
  };

  const canCreateChild = () => {
    if (!selectedConfig || Boolean(selectedConfig.archived)) return false;
    if (selectedConfig.type === "PRODUCT" && user.role === "ADMIN") return true;
    if (selectedConfig.type === "INSTANCE") return true;
    if (selectedConfig.type === "USER") return false; // USER configs cannot have children
    if (selectedConfig.type === "COMPONENT" && user.role === "ADMIN")
      return true;
    if (selectedConfig.type === "VERSION") return false; // VERSION configs cannot have children
    return false;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Cog6ToothIcon className="w-8 h-8 text-primary-600" />
            <h1 className="text-xl font-semibold text-gray-900">
              Configuration Manager
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {user.role === "ADMIN" && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCreateProduct}
                  className="btn-primary flex items-center space-x-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>New Product</span>
                </button>
                <button
                  onClick={handleCreateComponent}
                  className="btn-secondary flex items-center space-x-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>New Component</span>
                </button>
              </div>
            )}

            {user.role === "ADMIN" && (
              <button
                onClick={() => setShowSettings(true)}
                className="btn-secondary flex items-center space-x-1"
                title="Database Settings"
              >
                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                <span>Settings</span>
              </button>
            )}

            <button
              onClick={() => setShowHelp(true)}
              className="btn-secondary flex items-center space-x-1"
              title="Open User Manual"
            >
              <QuestionMarkCircleIcon className="w-4 h-4" />
              <span>Help</span>
            </button>

            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <UserIcon className="w-4 h-4" />
              <span>{user.username}</span>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  user.role === "ADMIN"
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {user.role}
              </span>
            </div>

            <button
              onClick={logout}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Left Panel - Configuration Tree */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Configurations
            </h2>
          </div>

          <div className="flex-1 overflow-auto">
            <ConfigurationTree
              selectedConfig={selectedConfig}
              onConfigSelect={handleConfigSelect}
              refreshTrigger={refreshTrigger}
              onEdit={handleTreeEdit}
              onRename={handleTreeRename}
              onDuplicate={handleTreeDuplicate}
              onCreateChild={handleTreeCreateChild}
              onCommit={handleTreeCommit}
              onDelete={handleTreeDelete}
              onArchive={handleTreeArchive}
              onRestore={handleTreeRestore}
              onAddComponent={handleAddComponent}
              user={user}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {selectedConfig ? (
            <>
              {/* Configuration Header */}
              <div className="bg-white border-b border-gray-200 p-6">
                <div
                  className="flex items-center justify-between"
                  onContextMenu={handleContextMenuShow}
                >
                  <div>
                    <h2 className={`text-xl font-semibold ${Boolean(selectedConfig.archived) ? 'text-gray-500' : 'text-gray-900'}`}>
                      {selectedConfig.name}
                      {Boolean(selectedConfig.archived) && (
                        <span className="ml-2 text-sm text-gray-400 font-normal">(archived)</span>
                      )}
                    </h2>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          selectedConfig.type === "PRODUCT"
                            ? "bg-blue-100 text-blue-800"
                            : selectedConfig.type === "INSTANCE"
                              ? "bg-green-100 text-green-800"
                              : "bg-purple-100 text-purple-800"
                        }`}
                      >
                        {selectedConfig.type}
                      </span>

                      {selectedConfig.status === "DRAFT" && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                          DRAFT
                        </span>
                      )}

                      {Boolean(selectedConfig.archived) && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                          ARCHIVED
                        </span>
                      )}

                      {selectedConfig.parent_name && (
                        <span>Parent: {selectedConfig.parent_name}</span>
                      )}

                      <span>
                        Created by: {selectedConfig.created_by_username}
                      </span>
                    </div>

                    {selectedConfig.description && (
                      <p className="mt-2 text-sm text-gray-600">
                        {selectedConfig.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    {canCreateChild() && (
                      <button
                        onClick={handleCreateChild}
                        className="btn-secondary flex items-center space-x-1"
                      >
                        <PlusIcon className="w-4 h-4" />
                        <span>Create Child</span>
                      </button>
                    )}

                    {canEdit() && (
                      <button
                        onClick={handleEdit}
                        className="btn-secondary flex items-center space-x-1"
                      >
                        <PencilIcon className="w-4 h-4" />
                        <span>Edit</span>
                      </button>
                    )}

                    {canRename() && (
                      <button
                        onClick={handleRename}
                        className="btn-secondary flex items-center space-x-1"
                      >
                        <DocumentTextIcon className="w-4 h-4" />
                        <span>Rename</span>
                      </button>
                    )}

                    {canCommit() && (
                      <button
                        onClick={handleCommit}
                        className="btn-primary flex items-center space-x-1"
                      >
                        <CheckIcon className="w-4 h-4" />
                        <span>Commit</span>
                      </button>
                    )}

                    {canArchive() && (
                      <button
                        onClick={() => handleTreeArchive(selectedConfig)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span>Archive</span>
                      </button>
                    )}

                    {canRestore() && (
                      <button
                        onClick={() => handleTreeRestore(selectedConfig)}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <CheckIcon className="w-4 h-4" />
                        <span>Restore</span>
                      </button>
                    )}

                    {/* Context Menu Button */}
                    <button
                      onClick={handleContextMenuShow}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      title="More options"
                    >
                      <EllipsisVerticalIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Archived Configuration Notice */}
              {Boolean(selectedConfig.archived) && (
                <div className="bg-amber-50 border-b border-amber-200 p-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                    <span className="text-amber-800 text-sm font-medium">
                      This configuration is archived and cannot be edited. Use the "Restore" button to make it editable again.
                    </span>
                  </div>
                </div>
              )}

              {/* Configuration Content */}
              <div className="flex-1 p-6 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 animate-spin border-2 border-gray-300 border-t-primary-600 rounded-full"></div>
                  </div>
                ) : error ? (
                  <div className="text-center text-red-600 p-8">
                    <p>{error}</p>
                    <button
                      onClick={() => loadConfigurationData(selectedConfig)}
                      className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                    >
                      Retry
                    </button>
                  </div>
                ) : resolvedData ? (
                  <InteractiveJSONViewer
                    data={resolvedData.resolved}
                    metadata={resolvedData.metadata}
                    title="Configuration Data"
                    className="max-w-none"
                    isEditable={canEdit()}
                    onDataChange={handleDataChange}
                    configType={selectedConfig?.type}
                  />
                ) : (
                  <div className="text-center text-gray-500 p-8">
                    Select a configuration to view its data
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <Cog6ToothIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Configuration Selected
                </h3>
                <p className="text-gray-600">
                  Select a configuration from the tree to view and edit its data
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Path Query Panel */}
      <PathQueryPanel
        configurations={allConfigurations}
        selectedConfig={selectedConfig}
      />

      {/* Configuration Editor Modal */}
      {(showEditor ||
        showCreateProduct ||
        showCreateComponent ||
        showCreateChild ||
        showRename) && (
        <ConfigurationEditor
          config={
            showCreateProduct || showCreateComponent ? null : selectedConfig
          }
          onClose={handleEditorClose}
          isCreatingProduct={showCreateProduct}
          isCreatingComponent={showCreateComponent}
          isCreatingChild={showCreateChild}
          isRenaming={showRename}
        />
      )}

      {/* Configuration Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Help Modal */}
      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        config={selectedConfig}
        isOpen={showDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
};

export default Dashboard;
