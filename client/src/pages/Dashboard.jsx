import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import ConfigurationTree from "../components/ConfigurationTree";
import InteractiveJSONViewer from "../components/InteractiveJSONViewer";
import ConfigurationEditor from "../components/ConfigurationEditor";
import { configAPI } from "../services/api";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  UserIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [resolvedData, setResolvedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showCreateProduct, setShowCreateProduct] = useState(false);

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

  const handleConfigSelect = (config) => {
    setSelectedConfig(config);
    setShowEditor(false);
    loadConfigurationData(config);
  };

  const handleCreateChild = () => {
    if (!selectedConfig) return;

    setShowEditor(true);
  };

  const handleCreateProduct = () => {
    setShowCreateProduct(true);
  };

  const handleEdit = () => {
    if (!selectedConfig) return;

    setShowEditor(true);
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
    if (success) {
      setRefreshTrigger((prev) => prev + 1);
      // Reload current config if it was edited
      if (selectedConfig) {
        loadConfigurationData(selectedConfig);
      }
    }
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
                <div className="flex items-center justify-between">
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

      {/* Configuration Editor Modal */}
      {(showEditor || showCreateProduct) && (
        <ConfigurationEditor
          config={showCreateProduct ? null : selectedConfig}
          onClose={handleEditorClose}
          isCreatingProduct={showCreateProduct}
        />
      )}
    </div>
  );
};

export default Dashboard;
