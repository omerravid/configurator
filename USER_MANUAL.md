# Configuration Manager - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Understanding Configuration Types](#understanding-configuration-types)
3. [User Interface Overview](#user-interface-overview)
4. [Creating Configurations](#creating-configurations)
5. [Managing Components and Versions](#managing-components-and-versions)
6. [Building Products with Components](#building-products-with-components)
7. [Working with Inheritance](#working-with-inheritance)
8. [Understanding Provenance Tracking](#understanding-provenance-tracking)
9. [User Permissions and Roles](#user-permissions-and-roles)
10. [Advanced Features](#advanced-features)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Login
- Access the Configuration Manager through your web browser
- Use your assigned credentials to log in
- Admin users have full access to all features
- Regular users have limited access to user configurations

### First Steps
1. After login, you'll see the main dashboard with a tree of configurations on the left
2. The center panel shows details of the selected configuration
3. The header contains action buttons for creating new configurations

---

## Understanding Configuration Types

The Configuration Manager uses a hierarchical system with five main types:

### 🔵 **Product** (Blue)
- **Purpose**: Top-level configurations that define complete applications or systems
- **Contains**: References to components and their versions
- **Created by**: Admins only
- **Can have children**: Instances

### 🟢 **Instance** (Green)  
- **Purpose**: Environment-specific deployments of products (e.g., staging, production)
- **Inherits from**: Products
- **Created by**: Admins and users
- **Can have children**: User configurations

### 🟣 **User Configuration** (Purple)
- **Purpose**: Personal customizations and overrides
- **Inherits from**: Instances or other user configurations
- **Created by**: Any user (for their own use)
- **Can have children**: Other user configurations
- **Status**: Created as DRAFT, can be committed to become read-only

### 🟦 **Component** (Teal)
- **Purpose**: Reusable configuration modules (e.g., database settings, API configurations)
- **Standalone**: Independent configurations that can be referenced by products
- **Created by**: Admins only
- **Can have children**: Versions

### 🟡 **Version** (Amber)
- **Purpose**: Specific versions of components with modifications or updates
- **Inherits from**: Parent component
- **Created by**: Admins and users
- **Status**: Created as DRAFT, can be committed to become read-only
- **Can have children**: Other versions

---

## User Interface Overview

### Left Panel - Configuration Tree
- **Hierarchical view** of all configurations
- **Colored icons** indicate configuration type
- **Expandable tree** shows parent-child relationships
- **Right-click** for context menu with available actions
- **Lock icons** 🔒 indicate committed (read-only) configurations

### Center Panel - Configuration Details
- **Header**: Configuration name, type, and creator information
- **Action buttons**: Edit, Create Child, Rename, Delete, Commit
- **JSON viewer**: Interactive display of configuration data
- **Provenance indicators**: Colored dots showing value origins

### Bottom Panel - API Query Tool
- **Configuration selector**: Choose any configuration
- **Path input**: Query specific JSON paths
- **Results display**: Shows resolved values with metadata
- **REST API demonstration**: Shows equivalent API calls

---

## Creating Configurations

### Creating a New Product
1. Click **"New Product"** in the header
2. Enter a name for your product
3. **Add components** using the component selector:
   - Select a component from the dropdown
   - Choose a specific version of that component
   - Repeat for additional components
4. Click **"Create Configuration"**
5. The product stores **references** to components, not copies of data

### Creating a New Component
1. Click **"New Component"** in the header
2. Enter a name and description
3. Define the JSON structure for your component
4. Click **"Create Configuration"**
5. The component acts as its own root version

### Creating Child Configurations
1. Select a parent configuration in the tree
2. Click **"Create Child"** or right-click and select from context menu
3. Enter a name for the child configuration
4. Start with empty JSON (inherits everything) or add overrides
5. Child type is determined automatically:
   - Product → Instance
   - Instance → User Configuration
   - Component → Version
   - User → User Configuration

---

## Managing Components and Versions

### Component Workflow
1. **Create Component**: Define base configuration with common settings
2. **Create Versions**: Add specific versions with modifications
3. **Use in Products**: Reference specific component versions in products

### Version Management
- **Root Version**: The component itself serves as the root version
- **Child Versions**: Create versions that inherit from the component
- **Inheritance**: Versions automatically inherit all component data
- **Overrides**: Versions can override specific properties from the component

### Committing Versions
- New versions are created as **DRAFT** status
- **Draft versions** can be edited and modified
- **Commit** a version to make it read-only and stable
- **Committed versions** show a lock icon 🔒

---

## Building Products with Components

### Component-Based Architecture
Products are built by combining multiple components:

```json
{
  "database": {
    "componentId": "comp_db_123",
    "versionId": "ver_db_v2_456",
    "componentName": "Database",
    "versionName": "Database_v2"
  },
  "api": {
    "componentId": "comp_api_789",
    "versionId": "comp_api_789",
    "componentName": "API",
    "versionName": "API (root)"
  }
}
```

### Component Selection Process
1. **Choose Component**: Select from available components
2. **Select Version**: Pick specific version (root or custom version)
3. **Preview**: See component references that will be stored
4. **Computed Resolution**: Actual data is computed during inheritance resolution

### Benefits
- **Modularity**: Reuse components across multiple products
- **Version Control**: Use specific versions for stability
- **Consistency**: Ensure all products using a component get updates when component changes
- **Maintainability**: Update component once, affects all dependent products

---

## Working with Inheritance

### Inheritance Chain
Values flow down through the hierarchy:
**Component → Version → Product → Instance → User Configuration**

### How Inheritance Works
1. **Base Values**: Start with the root configuration
2. **Overrides**: Each level can override specific properties
3. **Merge Strategy**: Objects are merged, primitives are replaced
4. **Resolution**: Final values are computed by combining all levels

### Example Inheritance
```
Component "Database": { "host": "localhost", "port": 5432, "ssl": false }
Version "Database_v2": { "ssl": true }  // Overrides ssl setting
Product "MyApp": Uses Database_v2
Instance "Staging": { "host": "staging.db.com" }  // Overrides host
User Config: { "port": 5433 }  // Personal override

Final Result: { "host": "staging.db.com", "port": 5433, "ssl": true }
```

---

## Understanding Provenance Tracking

### Visual Indicators
Each value in the JSON viewer shows colored dots indicating its origin:

- 🔵 **Blue**: From Product
- 🟦 **Teal**: From Component  
- 🟡 **Amber**: From Version (shows "ComponentName (VersionName)")
- 🟢 **Green**: From Instance
- 🟣 **Purple**: From User Configuration

### Tooltips
Hover over values to see detailed provenance information:
- **Source**: Which configuration defined this value
- **Type**: What type of configuration it came from
- **Path**: The exact location in the inheritance chain

### Inheritance Chain View
Click **"Show Inheritance Chain"** to see:
- Complete hierarchy from root to current configuration
- What each level contributes
- Visual representation of the inheritance flow

---

## User Permissions and Roles

### Admin Users
**Full Access**:
- ✅ Create/edit/delete all configuration types
- ✅ Create and manage components
- ✅ Create and manage products
- ✅ Access all configurations
- ✅ Commit any draft configuration

### Regular Users
**Limited Access**:
- ✅ Create and edit their own user configurations
- ✅ View all configurations (read-only)
- ✅ Create children of instances they have access to
- ✅ Commit their own draft configurations
- ❌ Cannot create/edit products, instances, or components
- ❌ Cannot edit configurations owned by others

### Draft vs Committed Status
- **Draft**: Editable, shows in orange/amber
- **Committed**: Read-only, shows lock icon 🔒
- **Workflow**: Create as draft → Edit and test → Commit when stable

---

## Advanced Features

### Interactive JSON Editing
- **Inline editing**: Click edit icon to modify values directly
- **Type validation**: Ensures correct data types
- **Real-time updates**: Changes are saved immediately
- **Context menus**: Right-click for copy/paste operations

### Context Menus
Right-click on any element for quick actions:
- **Copy Value**: Copy the actual value
- **Copy Path**: Copy the JSON path
- **Copy as JSON**: Copy the complete object
- **Edit**: Start inline editing

### API Integration
The bottom panel demonstrates REST API usage:
- **Query by path**: Get specific values from configurations
- **Show equivalent API calls**: Learn how to integrate programmatically
- **Metadata**: View inheritance information via API

### Search and Navigation
- **Tree expansion**: Click arrows to expand/collapse sections
- **Quick selection**: Click any configuration to view details
- **Inheritance details toggle**: Show/hide detailed inheritance information

---

## Best Practices

### Component Design
1. **Single Responsibility**: Each component should handle one aspect (database, API, cache)
2. **Sensible Defaults**: Component root should have production-ready defaults
3. **Clear Naming**: Use descriptive names for components and versions
4. **Documentation**: Add meaningful descriptions to configurations

### Version Management
1. **Semantic Versioning**: Use clear version naming (v1, v2, production, staging)
2. **Stable Versions**: Commit versions when they're stable and tested
3. **Backward Compatibility**: Avoid breaking changes in minor versions
4. **Change Documentation**: Document what changed in each version

### Product Architecture
1. **Modular Design**: Use components for different system aspects
2. **Environment Strategy**: Create instances for different environments
3. **Consistent Structure**: Use similar component combinations across products
4. **Version Pinning**: Use specific component versions for stability

### Configuration Hierarchy
1. **Logical Structure**: Organize configurations in a clear hierarchy
2. **Minimal Overrides**: Only override what's necessary at each level
3. **Clear Ownership**: Assign clear ownership for each configuration level
4. **Testing Strategy**: Test configurations at each inheritance level

---

## Troubleshooting

### Common Issues

**"Permission Denied" Errors**
- Check if you have the right role (admin vs user)
- Verify you own the configuration you're trying to edit
- Ensure the configuration is in DRAFT status (not committed)

**"Configuration Not Found" Errors**
- Verify the configuration exists in the tree
- Check if it was recently deleted
- Ensure you have access permissions to view it

**Inheritance Not Working**
- Check the inheritance chain is properly connected
- Verify parent configurations exist and are accessible
- Look for circular references in the hierarchy

**Values Not Updating**
- Refresh the page to reload data
- Check if the configuration is committed (read-only)
- Verify you have edit permissions

**Component Resolution Issues**
- Ensure referenced components and versions exist
- Check that component versions are accessible
- Verify the component structure is valid

### Getting Help

1. **Hover tooltips**: Most UI elements have helpful tooltips
2. **Provenance tracking**: Use colored dots to understand value origins
3. **API panel**: Use the bottom panel to test queries and understand data flow
4. **Inheritance chain**: Use the inheritance view to debug complex hierarchies

### Performance Tips

1. **Limit nesting depth**: Avoid overly deep inheritance chains
2. **Component reuse**: Prefer reusing components over duplicating data
3. **Selective overrides**: Only override necessary values at each level
4. **Regular cleanup**: Remove unused configurations and versions

---

## Conclusion

The Configuration Manager provides a powerful, hierarchical approach to managing application configurations. By understanding the component-based architecture, inheritance system, and proper use of the different configuration types, you can build maintainable, scalable configuration management solutions.

For additional support or questions not covered in this manual, contact your system administrator or refer to the API documentation for programmatic integration.
