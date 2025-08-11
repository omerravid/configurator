import React, { useState } from "react";
import { XMarkIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const HelpModal = ({ isOpen, onClose }) => {
  const [expandedSections, setExpandedSections] = useState({});

  if (!isOpen) return null;

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const userManualContent = {
    "getting-started": {
      title: "Getting Started",
      content: `
**Login**
- Access the Configuration Manager through your web browser
- Use your assigned credentials to log in
- Admin users have full access to all features
- Regular users have limited access to user configurations

**First Steps**
1. After login, you'll see the main dashboard with a tree of configurations on the left
2. The center panel shows details of the selected configuration
3. The header contains action buttons for creating new configurations
      `
    },
    "configuration-types": {
      title: "Understanding Configuration Types",
      content: `
The Configuration Manager uses a hierarchical system with five main types:

**🔵 Product (Blue)**
- Purpose: Top-level configurations that define complete applications or systems
- Contains: References to components and their versions
- Created by: Admins only
- Can have children: Instances

**🟢 Instance (Green)**
- Purpose: Environment-specific deployments of products (e.g., staging, production)
- Inherits from: Products
- Created by: Admins and users
- Can have children: User configurations

**🟣 User Configuration (Purple)**
- Purpose: Personal customizations and overrides
- Inherits from: Instances or other user configurations
- Created by: Any user (for their own use)
- Can have children: Other user configurations
- Status: Created as DRAFT, can be committed to become read-only

**🟦 Component (Teal)**
- Purpose: Reusable configuration modules (e.g., database settings, API configurations)
- Standalone: Independent configurations that can be referenced by products
- Created by: Admins only
- Can have children: Versions

**🟡 Version (Amber)**
- Purpose: Specific versions of components with modifications or updates
- Inherits from: Parent component
- Created by: Admins and users
- Status: Created as DRAFT, can be committed to become read-only
- Can have children: Other versions
      `
    },
    "user-interface": {
      title: "User Interface Overview",
      content: `
**Left Panel - Configuration Tree**
- Hierarchical view of all configurations
- Colored icons indicate configuration type
- Expandable tree shows parent-child relationships
- Right-click for context menu with available actions
- Lock icons 🔒 indicate committed (read-only) configurations
- Drag-and-drop: Drag components/versions into products for quick addition

**Center Panel - Configuration Details**
- Header: Configuration name, type, and creator information
- Action buttons: Edit, Create Child, Rename, Delete, Commit
- View modes: Toggle between "Flat" and "Structural" JSON views
- JSON viewer: Interactive display of configuration data
- Provenance indicators: Colored dots showing value origins
- Import button: Available for empty components to import folder structures

**Structural View Mode**
- Left tree: Shows only objects and arrays in hierarchical structure
- Right panel: Displays scalar properties of selected structural items
- Context menus: Right-click for copy, paste, add, rename, delete operations
- Inline editing: Direct modification of property values

**Bottom Panel - API Query Tool**
- Configuration selector: Choose any configuration
- Path input: Query specific JSON paths
- Results display: Shows resolved values with metadata
- REST API demonstration: Shows equivalent API calls
      `
    },
    "creating-configurations": {
      title: "Creating Configurations",
      content: `
**Creating a New Product**
1. Click "New Product" in the header
2. Enter a name for your product
3. Add components using the component selector:
   - Select a component from the dropdown
   - Choose a specific version of that component
   - Repeat for additional components
4. Alternatively, drag components/versions from the tree directly into the product
5. Click "Create Configuration"
6. The product stores references to components, not copies of data

**Creating a New Component**
1. Click "New Component" in the header
2. Enter a name and description
3. Define the JSON structure for your component
4. For empty components, use the "Import" button to import folder structures
5. Click "Create Configuration"
6. The component acts as its own root version

**Importing Component Structure**
1. Click "Import" button (appears only for empty components)
2. Select a folder from your local computer
3. System will create JSON structure based on folder hierarchy
4. JSON files in folders will be included in the structure
5. Review and modify the imported structure as needed

**Creating Child Configurations**
1. Select a parent configuration in the tree
2. Click "Create Child" or right-click and select from context menu
3. Enter a name for the child configuration
4. Start with empty JSON (inherits everything) or add overrides
5. Child type is determined automatically:
   - Product → Instance
   - Instance → User Configuration
   - Component → Version
   - User → User Configuration
      `
    },
    "inheritance": {
      title: "Working with Inheritance",
      content: `
**Inheritance Chain**
Values flow down through the hierarchy:
Component → Version → Product → Instance → User Configuration

**How Inheritance Works**
1. Base Values: Start with the root configuration
2. Overrides: Each level can override specific properties
3. Merge Strategy: Objects are merged, primitives are replaced
4. Resolution: Final values are computed by combining all levels

**Example Inheritance**
\`\`\`
Component "Database": { "host": "localhost", "port": 5432, "ssl": false }
Version "Database_v2": { "ssl": true }  // Overrides ssl setting
Product "MyApp": Uses Database_v2
Instance "Staging": { "host": "staging.db.com" }  // Overrides host
User Config: { "port": 5433 }  // Personal override

Final Result: { "host": "staging.db.com", "port": 5433, "ssl": true }
\`\`\`
      `
    },
    "provenance": {
      title: "Understanding Provenance Tracking",
      content: `
**Visual Indicators**
Each value in the JSON viewer shows colored dots indicating its origin:

- 🔵 Blue: From Product
- 🟦 Teal: From Component  
- 🟡 Amber: From Version (shows "ComponentName (VersionName)")
- 🟢 Green: From Instance
- 🟣 Purple: From User Configuration

**Tooltips**
Hover over values to see detailed provenance information:
- Source: Which configuration defined this value
- Type: What type of configuration it came from
- Path: The exact location in the inheritance chain

**Inheritance Chain View**
Click "Show Inheritance Chain" to see:
- Complete hierarchy from root to current configuration
- What each level contributes
- Visual representation of the inheritance flow
      `
    },
    "permissions": {
      title: "User Permissions and Roles",
      content: `
**Admin Users - Full Access:**
- ✅ Create/edit/delete all configuration types
- ✅ Create and manage components
- ✅ Create and manage products
- ✅ Access all configurations
- ✅ Commit any draft configuration

**Regular Users - Limited Access:**
- ✅ Create and edit their own user configurations
- ✅ View all configurations (read-only)
- ✅ Create children of instances they have access to
- ✅ Commit their own draft configurations
- ❌ Cannot create/edit products, instances, or components
- ❌ Cannot edit configurations owned by others

**Draft vs Committed Status**
- Draft: Editable, shows in orange/amber
- Committed: Read-only, shows lock icon 🔒
- Workflow: Create as draft → Edit and test → Commit when stable
      `
    },
    "structural-editing": {
      title: "Structural View and Advanced Editing",
      content: `
**Structural View Mode**
Toggle between "Flat" and "Structural" views using the mode selector:

**Flat View**
- Shows all configuration data in a traditional JSON tree format
- Single panel with expandable/collapsible sections
- Provenance indicators for each value
- Suitable for reviewing complete configuration data

**Structural View**
- Split-panel interface for complex configuration editing
- Left panel: Hierarchical tree showing only objects and arrays
- Right panel: Scalar properties of selected structural items
- Enhanced editing capabilities with context menus

**Left Panel - Structural Tree**
- Click to expand/collapse objects and arrays
- Select items to view their scalar properties in right panel
- Right-click for context menu with structural operations:
  - Add Object/Array: Create new nested structures
  - Rename: Change object keys with approve/cancel buttons
  - Delete: Remove structural elements
  - Copy/Paste: Duplicate structural elements
- Drag handle for components/versions (enables drag-and-drop)

**Right Panel - Scalar Properties**
- Shows only primitive values (strings, numbers, booleans) for selected item
- Inline editing: Click edit icon to modify values directly
- Add Property: Create new scalar properties
- Delete Property: Remove individual properties
- Context menu operations:
  - Copy Value: Copy the actual property value
  - Copy Path: Copy the full JSON path to the property
  - Copy as JSON: Copy the property as JSON format

**Drag-and-Drop Component Integration**
- Drag components from the configuration tree into products
- Drag specific versions for precise version control
- Components added as direct properties with proper metadata:
  - componentId: Reference to the component
  - versionId: Reference to the specific version
  - componentName: Human-readable component name
  - versionName: Human-readable version identifier
- Visual feedback during drag operations with hover effects
- Only valid drop targets (products) accept dropped components

**Import Functionality for Components**
- Import button available only for empty components
- Select entire folders from your local file system
- Automatically builds JSON structure from folder hierarchy
- Includes content from JSON files found in folders
- Preserves folder structure as nested objects
- Review and modify imported structure before saving

**Context Menu Operations**
Available in both flat and structural views:
- Copy Value: Get the actual data value
- Copy Path: Get the JSON path for API access
- Copy as JSON: Get formatted JSON representation
- Edit: Start inline editing mode
- Add/Remove: Modify structure (structural view only)
- Paste: Insert copied structural elements (structural view only)

**Best Practices for Structural Editing**
1. Use structural view for complex configurations with deep nesting
2. Organize related properties under logical object groupings
3. Use meaningful names for objects and arrays
4. Test changes in both view modes to ensure consistency
5. Use drag-and-drop for quick component integration
6. Import folder structures for rapid component prototyping
      `
    },
    "best-practices": {
      title: "Best Practices",
      content: `
**Component Design**
1. Single Responsibility: Each component should handle one aspect (database, API, cache)
2. Sensible Defaults: Component root should have production-ready defaults
3. Clear Naming: Use descriptive names for components and versions
4. Documentation: Add meaningful descriptions to configurations

**Version Management**
1. Semantic Versioning: Use clear version naming (v1, v2, production, staging)
2. Stable Versions: Commit versions when they're stable and tested
3. Backward Compatibility: Avoid breaking changes in minor versions
4. Change Documentation: Document what changed in each version

**Product Architecture**
1. Modular Design: Use components for different system aspects
2. Environment Strategy: Create instances for different environments
3. Consistent Structure: Use similar component combinations across products
4. Version Pinning: Use specific component versions for stability
      `
    },
    "troubleshooting": {
      title: "Troubleshooting",
      content: `
**Common Issues**

"Permission Denied" Errors
- Check if you have the right role (admin vs user)
- Verify you own the configuration you're trying to edit
- Ensure the configuration is in DRAFT status (not committed)

"Configuration Not Found" Errors
- Verify the configuration exists in the tree
- Check if it was recently deleted
- Ensure you have access permissions to view it

Inheritance Not Working
- Check the inheritance chain is properly connected
- Verify parent configurations exist and are accessible
- Look for circular references in the hierarchy

Values Not Updating
- Refresh the page to reload data
- Check if the configuration is committed (read-only)
- Verify you have edit permissions
- In structural view, ensure you're editing the correct property panel

Component Resolution Issues
- Ensure referenced components and versions exist
- Check that component versions are accessible
- Verify the component structure is valid

Copy/Paste Issues
- Copy functionality uses fallback methods in iframe environments
- If clipboard operations fail, try using browser's native copy/paste
- Ensure you have the correct selection before copying

Drag-and-Drop Issues
- Only components and versions can be dragged
- Only products can receive dropped components
- Ensure drag operation completes over a valid drop target
- Check that the component/version exists and is accessible

Import Issues
- Import button only appears for empty components
- Ensure folder contains valid JSON files
- Check file permissions and accessibility
- Verify folder structure is not too complex or deeply nested

**Getting Help**
1. Hover tooltips: Most UI elements have helpful tooltips
2. Provenance tracking: Use colored dots to understand value origins
3. API panel: Use the bottom panel to test queries and understand data flow
4. Inheritance chain: Use the inheritance view to debug complex hierarchies
5. View modes: Switch between Flat and Structural views for different perspectives
6. Context menus: Right-click elements for additional options and operations
      `
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Configuration Manager - User Manual</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {Object.entries(userManualContent).map(([sectionId, section]) => (
              <div key={sectionId} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleSection(sectionId)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900">{section.title}</h3>
                  {expandedSections[sectionId] ? (
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                
                {expandedSections[sectionId] && (
                  <div className="px-4 pb-4 border-t border-gray-100">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                        {section.content.trim()}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6">
          <p className="text-sm text-gray-600 text-center">
            For additional support or questions not covered in this manual, contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
