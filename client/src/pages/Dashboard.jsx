import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ConfigurationTree from "../components/ConfigurationTree";
import InteractiveJSONViewer from "../components/InteractiveJSONViewer";
import ConfigurationEditor from "../components/ConfigurationEditor";
import PathQueryPanel from "../components/PathQueryPanel";
import ContextMenu from "../components/ContextMenu";
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
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);

  const loadAllConfigurations = async () => {
    try {
      const response = await configAPI.getAll();
      setAllConfigurations(response.data.configurations || []);
    } catch (err) {
      console.error("Failed to load all configurations:", err);
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

      // USER configurations should always be created as DRAFT when copied
      if (selectedConfig.type === "USER") {
        newConfig.status = "DRAFT";
      }

      await configAPI.create(newConfig);

      // Refresh the tree and configurations list
      setRefreshTrigger((prev) => prev + 1);
      loadAllConfigurations();

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
      const existingNames = response.data.configurations.map((c) => c.name);

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

  const handleDelete = async () => {
    if (
      !selectedConfig ||
      !window.confirm("Are you sure you want to delete this configuration?")
    ) {
      return;
    }

    try {
      await configAPI.delete(selectedConfig.id);
      setSelectedConfig(null);
      setResolvedData(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      console.error("Failed to delete configuration:", err);
      setError("Failed to delete configuration");
    }
  };

  const handleEditorClose = (success) => {
    setShowEditor(false);
    setShowCreateProduct(false);
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
      // Get the raw configuration data (only this level's overrides)
      const rawResponse = await configAPI.getRawById(selectedConfig.id);
      const currentData = rawResponse.data.resolved || {};

      // For child configurations, we need to validate the path exists in parent
      if (selectedConfig.type !== "PRODUCT" && selectedConfig.parent_id) {
        try {
          // Check if the path exists in the resolved parent configuration
          const resolvedParent = await configAPI.getById(
            selectedConfig.parent_id,
            true,
          );
          const parentResolved = resolvedParent.data.resolved || {};

          // Check if path exists in parent by traversing the path
          const pathParts = path.split(".");
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
      }

      const pathParts = path.split(".");
      const newData = JSON.parse(JSON.stringify(currentData)); // Deep clone

      // Navigate to the parent of the target property
      let current = newData;
      for (let i = 0; i < pathParts.length - 1; i++) {
        if (!current[pathParts[i]]) {
          current[pathParts[i]] = {};
        }
        current = current[pathParts[i]];
      }

      // Set the new value
      current[pathParts[pathParts.length - 1]] = newValue;

      // Update the configuration with only the modified data
      await configAPI.update(selectedConfig.id, { data: newData });

      // Reload the configuration data
      await loadConfigurationData(selectedConfig);

      // Refresh the tree
      setRefreshTrigger((prev) => prev + 1);

      // Show success toast
      showToast(`Updated ${path} successfully`);
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

    if (canDelete()) {
      menuItems.push({
        label: `Delete "${selectedConfig.name}"`,
        icon: TrashIcon,
        onClick: handleDelete,
      });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: menuItems,
    });
  };

  const canEdit = () => {
    if (!selectedConfig) return false;
    if (user.role === "ADMIN") return true;
    return (
      selectedConfig.type === "USER" &&
      selectedConfig.created_by === user.id &&
      selectedConfig.status === "DRAFT"
    );
  };

  const canRename = () => {
    return selectedConfig && user.role === "ADMIN";
  };

  const canDelete = () => {
    return selectedConfig && user.role === "ADMIN";
  };

  const canCommit = () => {
    if (!selectedConfig) return false;
    if (selectedConfig.type !== "USER") return false;
    if (selectedConfig.status !== "DRAFT") return false;
    return user.role === "ADMIN" || selectedConfig.created_by === user.id;
  };

  const canCreateChild = () => {
    if (!selectedConfig) return false;
    if (selectedConfig.type === "PRODUCT" && user.role === "ADMIN") return true;
    if (selectedConfig.type === "INSTANCE") return true;
    if (selectedConfig.type === "USER") return true;
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
              <button
                onClick={handleCreateProduct}
                className="btn-primary flex items-center space-x-1"
              >
                <PlusIcon className="w-4 h-4" />
                <span>New Product</span>
              </button>
            )}

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

      <div className="flex h-screen pt-16">
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
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedConfig.name}
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

                    {canDelete() && (
                      <button
                        onClick={handleDelete}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-1"
                      >
                        <TrashIcon className="w-4 h-4" />
                        <span>Delete</span>
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
      {(showEditor || showCreateProduct || showCreateChild || showRename) && (
        <ConfigurationEditor
          config={showCreateProduct ? null : selectedConfig}
          onClose={handleEditorClose}
          isCreatingProduct={showCreateProduct}
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
    </div>
  );
};

export default Dashboard;
