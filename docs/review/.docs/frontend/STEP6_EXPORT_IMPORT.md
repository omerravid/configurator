# Step 6: Export/Import Flows - Implementation Documentation

## Overview
Implemented comprehensive export/import functionality allowing users to export configurations to JSON files and import them back with validation and conflict resolution.

## Features Implemented

### 1. Export Functionality

#### Export All Configurations
- **Location:** Dashboard header "Export" button
- **Functionality:**
  - Exports all configurations (active and archived) to JSON file
  - Automatically generates filename with timestamp
  - Includes metadata: version, export date, count
  - Pretty-printed JSON (2-space indentation)

#### Export Single Configuration
- **Location:** Context menu "Export [name]" option
- **Functionality:**
  - Exports selected configuration to JSON file
  - Filename based on configuration name (sanitized)
  - Same format as bulk export but single item

#### Export Data Structure
```json
{
  "version": "1.0",
  "exportedAt": "2024-01-15T10:30:00.000Z",
  "count": 3,
  "configurations": [
    {
      "name": "config-name",
      "type": "PRODUCT|COMPONENT|VERSION|INSTANCE|USER",
      "description": "description text",
      "parent_id": "parent-id-or-null",
      "parent_name": "parent-name-or-null",
      "data": { /* configuration data */ },
      "status": "DRAFT|COMMITTED",
      "created_by": "user-id",
      "created_by_username": "username",
      "archived": false
    }
  ]
}
```

**Note:** Internal IDs and timestamps (id, created_at, updated_at) are excluded for portability.

### 2. Import Functionality

#### Import Modal UI
- **Trigger:** Dashboard header "Import" button
- **Features:**
  - Drag-and-drop file upload
  - File browser selection
  - File type validation (.json only)
  - File size limit (10MB)
  - Real-time validation feedback
  - Import options configuration
  - Progress tracking
  - Results display

#### Validation
- **File Validation:**
  - Must be valid JSON
  - Must have version field
  - Must have configurations array
  - Must have at least one configuration

- **Configuration Validation:**
  - Required fields: name, type
  - Valid type enum values
  - Data field must be object if present
  - Per-configuration error reporting

#### Import Options

##### Rename on Conflict
- **Default:** Enabled
- **Behavior:**
  - Checks for name conflicts with existing configurations
  - Automatically appends "_imported" suffix
  - Increments counter if "_imported" also exists
  - Example: `config` → `config_imported` → `config_imported_2`

##### Import as Drafts
- **Default:** Enabled
- **Behavior:**
  - Sets all imported configurations to DRAFT status
  - Allows review before committing
  - Ignores original status if enabled

#### Import Process
1. User selects JSON file
2. File parsed and validated
3. Validation errors displayed if any
4. User configures import options
5. User clicks "Import Configurations"
6. Configurations created one by one
7. Success/error results displayed
8. Tree refreshes automatically
9. Modal closes after 2 seconds if successful

#### Error Handling
- **Per-item error tracking:**
  - Continues import even if some items fail
  - Collects error messages per configuration
  - Displays success and failure counts
  - Shows up to 5 errors (with "...and X more" message)

### 3. Export Utility Functions

#### `exportConfigurations(configurations, filename)`
- Exports array of configurations to JSON file
- Auto-generates timestamp-based filename if not provided
- Creates blob and triggers download
- Returns result object with success status

#### `exportSingleConfiguration(configuration, filename)`
- Wrapper for exporting single configuration
- Sanitizes configuration name for filename
- Calls exportConfigurations internally

#### `validateImportData(data)`
- Validates parsed JSON structure
- Checks version, configurations array
- Validates each configuration
- Returns validation result with errors array

#### `parseImportFile(file)`
- Reads file as text
- Parses JSON
- Validates structure
- Returns parsed data and validation result
- Rejects with error if invalid

#### `prepareConfigurationsForImport(configurations, existing, options)`
- Removes internal IDs
- Handles name conflicts
- Applies import options
- Sets parent_id to null (user must reassign)
- Returns prepared configuration array

#### `generateImportSummary(imported, failed)`
- Generates import summary report
- Separates successful and failed imports
- Includes configuration details and errors

## UI Components

### Import Modal (`ImportModal.jsx`)

#### Structure
```
┌─────────────────────────────────────────┐
│ Header: Import Configurations          │
├─────────────────────────────────────────┤
│ Content:                                │
│   1. File Upload Area (drag/drop)      │
│   2. File Info Display                 │
│   3. Validation Results                │
│   4. Import Options (checkboxes)       │
│   5. Import Results (after import)     │
├─────────────────────────────────────────┤
│ Footer: [Cancel] [Import]              │
└─────────────────────────────────────────┘
```

#### States
- `file`: Selected file object
- `dragActive`: Drag-over state for upload area
- `parsedData`: Parsed JSON data
- `validation`: Validation result
- `importing`: Import in progress
- `importResult`: Import completion result
- `options`: Import options configuration

#### Props
- `isOpen`: Modal visibility
- `onClose`: Close handler
- `onImport`: Import handler (returns Promise)
- `existingConfigurations`: For conflict detection

#### Features
- Drag-and-drop file upload with visual feedback
- File type and size validation
- Real-time JSON parsing and validation
- Import options with checkboxes
- Progress indication during import
- Success/error result display
- Escape key to close (except during import)
- Auto-close after successful import

## Integration Points

### Dashboard Header
```jsx
<button onClick={handleExportAll}>
  <ArrowDownTrayIcon />
  Export
</button>

<button onClick={() => setShowImport(true)}>
  <ArrowUpTrayIcon />
  Import
</button>
```

### Context Menu
```jsx
{
  label: `Export "${selectedConfig.name}"`,
  icon: ArrowDownTrayIcon,
  onClick: handleExportSelected,
}
```

### Handlers
```javascript
const handleExportAll = useCallback(() => {
  const result = exportConfigurations(allConfigurations);
  showToast(`Exported ${result.count} configurations`);
}, [allConfigurations]);

const handleExportSelected = useCallback(() => {
  const result = exportSingleConfiguration(selectedConfig);
  showToast(`Exported "${selectedConfig.name}"`);
}, [selectedConfig]);

const handleImport = async (configurations) => {
  const results = { successCount: 0, failureCount: 0, errors: [] };
  
  for (const config of configurations) {
    try {
      await configAPI.create(config);
      results.successCount++;
    } catch (error) {
      results.failureCount++;
      results.errors.push(`${config.name}: ${error.message}`);
    }
  }
  
  setRefreshTrigger(prev => prev + 1);
  return results;
};
```

## Use Cases

### Use Case 1: Backup All Configurations
1. Click "Export" button in header
2. All configurations downloaded to JSON file
3. File saved with timestamp in name
4. Success toast shown

### Use Case 2: Share Single Configuration
1. Select configuration
2. Right-click or click context menu
3. Click "Export [name]"
4. Configuration downloaded to JSON file
5. File named after configuration

### Use Case 3: Import Configurations
1. Click "Import" button in header
2. Drag JSON file to upload area or click to browse
3. File validated automatically
4. Review validation results
5. Configure import options
6. Click "Import Configurations"
7. Watch progress
8. View success/error results
9. Modal auto-closes if successful
10. Tree refreshes with new configurations

### Use Case 4: Handle Import Errors
1. Import file with errors
2. Validation errors displayed before import
3. Fix file and retry
4. During import, per-item errors collected
5. Partial success possible (some import, some fail)
6. Error details shown for failed items

### Use Case 5: Resolve Name Conflicts
1. Import file with existing configuration names
2. Enable "Rename on conflict" option
3. Conflicting configurations renamed automatically
4. Import proceeds without errors
5. New configurations have "_imported" suffix

## File Structure

### New Files
```
client/src/
├── utils/
│   └── exportImport.js          # Export/import utility functions
└── components/
    └── ImportModal.jsx          # Import modal component
```

### Modified Files
```
client/src/
└── pages/
    └── Dashboard.jsx            # Added export/import integration
```

## Dependencies

### Icons
- `ArrowDownTrayIcon` - Export button
- `ArrowUpTrayIcon` - Import button
- `DocumentTextIcon` - File display
- `CheckCircleIcon` - Success indicator
- `ExclamationTriangleIcon` - Error indicator
- `XMarkIcon` - Close/remove buttons

### Utilities
- `logger` - Logging import/export operations
- `accessibility` - useEscapeKey hook for modal
- `FormComponents` - Spinner component

### APIs
- `configAPI.create()` - Create imported configurations
- `configAPI.getAll()` - Refresh after import

## Error Messages

### Validation Errors
- "No data provided"
- "Missing version field"
- "configurations must be an array"
- "No configurations found in import file"
- "Configuration X: missing or invalid name"
- "Configuration X: missing or invalid type"
- "Configuration X: data must be an object"

### File Errors
- "File must be a JSON file (.json)"
- "File size exceeds 10MB limit"
- "Invalid JSON format"
- "Failed to read file"

### Import Errors
- "No configuration selected" (export single)
- "No configurations to export" (export all)
- Per-configuration errors from API

## Best Practices

### Export
1. Export regularly as backup
2. Export before major changes
3. Use descriptive filenames for manual exports
4. Keep exports organized by date/purpose

### Import
1. Validate files before importing
2. Use "Rename on conflict" to avoid overwrites
3. Import as drafts to review first
4. Check import results for errors
5. Review imported configurations before committing

### File Management
1. Store exports in version control for templates
2. Document export file purpose in commit messages
3. Share exports for collaboration
4. Use exports to migrate between environments

## Testing Checklist

### Export Testing
- [ ] Export all configurations works
- [ ] Export single configuration works
- [ ] Exported JSON is valid and readable
- [ ] Exported JSON contains all required fields
- [ ] Filename generation works correctly
- [ ] Download triggers properly
- [ ] Success toast displays
- [ ] Error handling for edge cases

### Import Testing
- [ ] Drag-and-drop file upload works
- [ ] File browser selection works
- [ ] File type validation works (.json only)
- [ ] File size validation works (10MB limit)
- [ ] JSON parsing works
- [ ] Validation errors display correctly
- [ ] Valid files pass validation
- [ ] Import options work correctly
- [ ] Rename on conflict works
- [ ] Import as drafts works
- [ ] Import progress shows
- [ ] Import results display correctly
- [ ] Partial success handled
- [ ] Tree refreshes after import
- [ ] Modal closes after success
- [ ] Escape key closes modal
- [ ] Cancel button works

### Integration Testing
- [ ] Export buttons visible in header
- [ ] Export option in context menu
- [ ] Import modal opens/closes correctly
- [ ] Exported files can be re-imported
- [ ] Name conflicts resolved automatically
- [ ] Imported configurations appear in tree
- [ ] Error toasts display correctly
- [ ] Success toasts display correctly

## Known Limitations

1. **Parent Relationships:** Parent IDs are not preserved on import (set to null). Users must manually reassign parent relationships after import.

2. **File Size:** Limited to 10MB to prevent browser memory issues with large files.

3. **IDs Not Preserved:** Internal database IDs are regenerated on import, so references between configurations may break.

4. **Synchronous Import:** Configurations imported one at a time (not batched) to collect per-item errors.

5. **No Validation of Data:** The `data` field content is not validated beyond being an object. Invalid data structures may cause issues later.

6. **No Dry Run:** No preview of import without actually importing. Users should use "Import as drafts" for safety.

## Future Enhancements

1. **Batch Import API:** Backend endpoint to import multiple configurations atomically
2. **Relationship Preservation:** Smart parent ID mapping on import
3. **Conflict Resolution UI:** User chooses skip/rename/overwrite per conflict
4. **Import Preview:** Show what will be imported before executing
5. **Selective Import:** Choose which configurations to import from file
6. **Export Templates:** Pre-configured export options for common scenarios
7. **Import History:** Track imported files and rollback capability
8. **Validation Rules:** Configurable validation for data field content
9. **Large File Support:** Streaming import for files >10MB
10. **Export Filters:** Export only selected/filtered configurations

## Performance Considerations

- File reading is async (doesn't block UI)
- JSON parsing happens in main thread (may block for large files)
- Import is sequential (one config at a time)
- Tree refresh after import may be slow with many configurations
- File downloads use Blob URLs (cleaned up after download)

## Security Considerations

- No server-side file upload (all client-side)
- JSON parsing may fail on malicious input (caught and handled)
- No code execution from imported files (JSON.parse is safe)
- File size limit prevents memory exhaustion
- Validation prevents injection of invalid data structures

## Accessibility

- Keyboard navigation supported
- Escape key closes modal
- Focus management in modal
- Screen reader announcements for file selection
- Clear error messages
- Descriptive button labels
- Proper ARIA attributes

## Summary

Step 6 successfully implements a complete export/import system for configurations with:
- ✅ Export all configurations
- ✅ Export single configuration  
- ✅ Import from JSON with validation
- ✅ Drag-and-drop file upload
- ✅ Conflict resolution
- ✅ Import options
- ✅ Error handling
- ✅ Progress tracking
- ✅ UI integration
- ✅ Documentation

The system is ready for use and testing!



