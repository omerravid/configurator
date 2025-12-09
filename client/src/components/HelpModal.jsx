import React, { useState } from "react";
import { XMarkIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useEscapeKey } from "../utils/accessibility.jsx";

const HelpModal = ({ isOpen, onClose }) => {
  const [expandedSections, setExpandedSections] = useState({});

  // Handle Escape key to close modal
  useEscapeKey(() => {
    if (isOpen) {
      onClose();
    }
  }, isOpen);

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
4. The interface starts in dark mode by default - use the theme toggle button to switch to light mode if preferred
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

**Theme Toggle**
- Dark/Light mode toggle button in the header
- Dark mode is the default theme for better readability
- Theme preference is automatically saved and remembered
- All interface elements adapt to the selected theme

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
- **Component Version Management**: For component references in products:
  - Displays compact "version" property with current selection
  - Dropdown selector to change component versions (products only)
  - Removal button (🗑️) to unlink components from products
- Inline editing: Click edit icon to modify values directly
- Add Property: Create new scalar properties (restricted by config type)
- Delete Property: Remove individual properties (restricted by config type)
- Context menu operations:
  - Copy Value: Copy the actual property value
  - Copy Path: Copy the full JSON path to the property
  - Copy as JSON: Copy the property as JSON format
  - Edit Value: Modify property values (based on permissions)
  - Delete Property: Remove properties (based on permissions)

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
    "component-management": {
      title: "Component Management & Version Control",
      content: `
**Component Version Editing in Products**
- When viewing a product configuration that contains components:
  - Select any component reference in the structural view
  - Properties panel shows a compact "version" property selector
  - Edit icon appears next to the version for products only
  - Dropdown shows all available versions of that component
  - Changes are applied immediately and preserved

**Component Removal from Products**
- In product configurations, components can be unlinked:
  - Navigate to the component reference in structural view
  - Properties panel shows the component version information
  - Trash icon (🗑️) appears on hover for removal
  - Click to unlink the component from the product
  - Component is removed but remains available for re-use

**Access Control by Configuration Type**
- **COMPONENT**: Full editing capabilities (add/remove properties, rename objects)
- **PRODUCT**: Component version management and value viewing only
- **INSTANCE**: Property value overriding allowed
- **USER**: Property value overriding allowed
- **VERSION**: Full editing capabilities like components

**Context Menu Restrictions**
Context menus adapt based on configuration type and permissions:
- Component/Version configs: Full structural editing options
- Product configs: Limited to component version changes and navigation
- Instance/User configs: Property value editing and navigation only
- Read-only configs: Copy and navigation options only

**Best Practices for Component Management**
1. **Product Level**: Use for component composition and version selection
2. **Instance/User Level**: Use for environment-specific value overrides
3. **Component Level**: Design reusable, well-documented modules
4. **Version Management**: Pin stable versions in products for consistency
5. **Removal Strategy**: Unlink unused components to keep products clean
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
    "file-handling": {
      title: "File Handling and Management",
      content: `
**File Storage Overview**
The Configuration Manager includes powerful file handling capabilities that allow you to store, manage, and reference files within your configurations.

**Storage Options**
- **Embedded Storage**: Files stored locally on the server (default)
- **S3 Cloud Storage**: Amazon S3 integration for scalable file storage
- **Automatic Switching**: Administrators can configure storage backend

**Supported File Types**
✅ **Documents**: PDF, DOC, DOCX, TXT, RTF, ODT
✅ **Images**: JPG, JPEG, PNG, GIF, BMP, WEBP, SVG, TIFF
✅ **Videos**: MP4, AVI, MOV, WMV, FLV, WEBM, MKV
✅ **Audio**: MP3, WAV, OGG, AAC, FLAC, WMA
✅ **Archives**: ZIP, RAR, 7Z, TAR, GZ
✅ **Data Files**: JSON, XML, CSV, YAML, SQL
✅ **Code Files**: JS, TS, HTML, CSS, PHP, PY, JAVA, CPP
✅ **Configuration**: INI, CONF, CONFIG, ENV
✅ **3D Models**: STL, OBJ, FBX, DAE, PLY
✅ **CAD Files**: DWG, DXF, STEP, IGS
✅ **Other**: Any file type up to 50MB

**File Upload Methods**

*Drag and Drop Upload*
1. Drag files from your computer directly into the file drop zone
2. Multiple files can be uploaded simultaneously
3. Visual feedback shows valid drop targets
4. Upload progress is displayed for large files

*Browse and Select*
1. Click the "Choose Files" or "Browse" button
2. Use your operating system's file picker
3. Select single or multiple files
4. Confirm upload to begin transfer

*Replace Existing Files*
1. Right-click on an existing file property
2. Select "Replace File" from context menu
3. Choose new file to replace the existing one
4. Old file is automatically removed from storage

**File Properties and Metadata**
Each uploaded file creates a structured file object:

{
  "_type": "file",
  "_metadata": {
    "originalName": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1048576,
    "storageKey": "abc123-file-id",
    "storageType": "embedded",
    "uploadDate": "2024-01-01T12:00:00Z"
  },
  "_link": "https://server.com/api/files/abc123-file-id"
}

**File Preview and Viewing**

*Image Preview*
- Automatic thumbnail generation for images
- Click to view full-size image in modal
- Support for all common image formats
- Zoom and pan functionality for large images

*Text File Preview*
- Inline preview for small text files
- Syntax highlighting for code files
- Line numbers and formatting preservation
- Download option for large files

*Document Preview*
- PDF files display with embedded viewer
- Navigation controls for multi-page documents
- Search functionality within documents
- Print and download options

*Video and Audio Preview*
- HTML5 media player integration
- Playback controls (play, pause, seek, volume)
- Multiple format support
- Streaming playback for large files

**File Management Operations**

*Download Files*
- Click file name or download button
- Preserves original filename and extension
- Secure download URLs with expiration
- Resume capability for large files

*Replace Files*
- Maintain same property path
- Automatic cleanup of old file versions
- Preserve file references in configurations
- Version history tracking

*Delete Files*
- Remove files from configurations
- Automatic cleanup from storage
- Cascade deletion warnings for referenced files
- Confirmation dialogs for safety

*Copy File References*
- Copy download URLs for external use
- Copy file metadata for debugging
- Share files between configurations
- Export file inventories

**File Security and Access Control**

*Authentication Required*
- All file operations require valid user authentication
- API key support for programmatic access
- Session-based security for web interface
- Role-based access restrictions

*Permission System*
- Admin users: Full file management access
- Regular users: Can upload and manage own files
- Read-only access for committed configurations
- Inherited permissions from parent configurations

*Storage Security*
- Encrypted file transfer (HTTPS)
- Secure storage backends
- Access logging and auditing
- Virus scanning integration (when configured)

**Integration with Configurations**

*File Properties in JSON*
Files appear as special objects in your configuration data:

"logo": {
  "_type": "file",
  "_metadata": { ... },
  "_link": "download-url"
}

*Inheritance and Overrides*
- File properties inherit like other configuration values
- Child configurations can override parent files
- File metadata is preserved through inheritance
- Provenance tracking shows file origins

*API Integration*
- REST API endpoints for file operations
- Programmatic upload and download
- Batch file processing capabilities
- Webhook notifications for file events

**Best Practices**

*File Organization*
1. Use descriptive filenames that indicate purpose
2. Organize files logically within configuration properties
3. Use folder-like property paths (e.g., "assets.images.logo")
4. Document file purposes in configuration descriptions

*File Size Management*
1. Keep files under 50MB for optimal performance
2. Use compression for large documents and archives
3. Consider external CDN for frequently accessed files
4. Regular cleanup of unused or outdated files

*Version Control*
1. Replace files rather than creating new properties
2. Use configuration versioning for file history
3. Document file changes in version descriptions
4. Test file accessibility after updates

*Performance Optimization*
1. Use appropriate file formats for use case
2. Compress images and videos when possible
3. Lazy load large files in applications
4. Cache frequently accessed files

**Troubleshooting File Issues**

*Upload Failures*
- Check file size is under 50MB limit
- Verify file is not corrupted
- Ensure stable internet connection
- Try uploading files individually if batch fails

*Preview Problems*
- Check file format is supported for preview
- Large files may not preview (download instead)
- Browser compatibility may affect preview features
- Clear browser cache if preview appears outdated

*Download Issues*
- Verify file still exists in storage
- Check user permissions for file access
- Download URLs expire - refresh page for new URL
- Network issues may interrupt large downloads

*Storage Problems*
- Contact administrator if storage quota exceeded
- Report missing files to system administrator
- Check configuration inheritance if file not found
- Verify file was not accidentally removed

**File Storage Configuration (Admin)**
Administrators can configure file storage backends:

*Embedded Storage*
- Files stored on local server filesystem
- Good for development and small deployments
- No additional service dependencies
- Limited by server disk space

*Amazon S3 Storage*
- Scalable cloud file storage
- Better for production deployments
- Automatic backups and redundancy
- Configurable access policies

*Storage Migration*
- Admin tools for migrating between storage types
- Automatic URL updates during migration
- Validation tools for file integrity
- Rollback capabilities if issues occur
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

Component Version Issues
- Version editing only available in product configurations
- Ensure you're viewing the component reference, not nested properties
- Dropdown may not appear if component has no versions available
- Check that component and versions exist and are accessible

Component Removal Issues
- Component removal only available in product configurations
- Must be viewing the component reference in structural view
- Trash icon appears on hover in the properties panel
- Ensure you have edit permissions for the product
- Removal unlinks the component but doesn't delete it from the system

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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Configuration Manager - User Manual</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {Object.entries(userManualContent).map(([sectionId, section]) => (
              <div key={sectionId} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                <button
                  onClick={() => toggleSection(sectionId)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{section.title}</h3>
                  {expandedSections[sectionId] ? (
                    <ChevronDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                
                {expandedSections[sectionId] && (
                  <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-600">
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans">
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
        <div className="border-t border-gray-200 dark:border-gray-700 p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            For additional support or questions not covered in this manual, contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
