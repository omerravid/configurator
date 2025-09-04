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
