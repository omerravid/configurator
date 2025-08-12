const { Configuration } = require("../models");
const { isPlainObject, cloneDeep } = require("lodash");

class ConfigurationService {
  /**
   * Deep merge two objects with provenance tracking
   * @param {Object} base - Base object
   * @param {Object} override - Override object
   * @param {Object} baseSource - Source metadata for base
   * @param {Object} overrideSource - Source metadata for override
   * @param {boolean} includeProvenance - Whether to include provenance data
   * @returns {Object} Merged object with optional provenance
   */
  static deepMergeWithProvenance(
    base,
    override,
    baseSource,
    overrideSource,
    includeProvenance = false,
  ) {
    const result = {};

    // Get all keys from both objects
    const allKeys = new Set([
      ...Object.keys(base || {}),
      ...Object.keys(override || {}),
    ]);

    for (const key of allKeys) {
      const baseValue = base?.[key];
      const overrideValue = override?.[key];

      let finalValue;
      let finalSource;

      if (overrideValue !== undefined) {
        // Override value exists
        if (isPlainObject(overrideValue) && isPlainObject(baseValue)) {
          // Both are objects, recursively merge
          finalValue = this.deepMergeWithProvenance(
            baseValue,
            overrideValue,
            baseSource,
            overrideSource,
            includeProvenance,
          );
          finalSource = overrideSource; // The override config is responsible for the merged object
        } else {
          // Override completely replaces base (for primitives and arrays)
          finalValue = cloneDeep(overrideValue);
          finalSource = overrideSource;
        }
      } else if (baseValue !== undefined) {
        // Only base value exists - this is an inherited value
        if (isPlainObject(baseValue)) {
          // For inherited objects, preserve existing provenance if it exists
          finalValue = this.preserveOriginalProvenance(
            baseValue,
            baseSource,
            includeProvenance,
          );
        } else {
          finalValue = cloneDeep(baseValue);
        }
        // For inherited values, preserve the original source if it already has provenance
        finalSource = this.extractOriginalSource(baseValue) || baseSource;
      }

      if (includeProvenance && finalValue !== undefined) {
        if (
          isPlainObject(finalValue) &&
          !Array.isArray(finalValue) &&
          !(
            finalValue.hasOwnProperty("value") &&
            finalValue.hasOwnProperty("source")
          )
        ) {
          // This is an object that already has provenance for its children, don't wrap it
          result[key] = finalValue;
        } else {
          // Wrap primitive values and arrays with provenance
          result[key] = {
            value: finalValue,
            source: finalSource,
          };
        }
      } else {
        result[key] = finalValue;
      }
    }

    return result;
  }

  /**
   * Add provenance to all properties in an object (for inherited values)
   */
  static addProvenanceToObject(obj, source, includeProvenance) {
    if (!isPlainObject(obj) || !includeProvenance) {
      return cloneDeep(obj);
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isPlainObject(value) && !Array.isArray(value)) {
        // Recursively handle nested objects
        result[key] = this.addProvenanceToObject(
          value,
          source,
          includeProvenance,
        );
      } else {
        // Wrap primitive values and arrays with provenance
        result[key] = {
          value: cloneDeep(value),
          source: source,
        };
      }
    }
    return result;
  }

  /**
   * Extract the original source from a value that might already have provenance
   * @param {any} value - Value that might have provenance wrapper
   * @returns {Object|null} Original source or null
   */
  static extractOriginalSource(value) {
    // Check if this is a provenance wrapper
    if (
      value &&
      typeof value === "object" &&
      value.hasOwnProperty("value") &&
      value.hasOwnProperty("source")
    ) {
      return value.source;
    }
    return null;
  }

  /**
   * Preserve existing provenance when inheriting values
   * @param {Object} obj - Object that might contain provenance-wrapped values
   * @param {Object} fallbackSource - Source to use if no provenance exists
   * @param {boolean} includeProvenance - Whether to include provenance
   * @returns {Object} Object with preserved provenance
   */
  static preserveOriginalProvenance(obj, fallbackSource, includeProvenance) {
    if (!isPlainObject(obj) || !includeProvenance) {
      return cloneDeep(obj);
    }

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (isPlainObject(value) && !Array.isArray(value)) {
        // Check if this is already a provenance wrapper
        if (value.hasOwnProperty("value") && value.hasOwnProperty("source")) {
          // This is a provenance wrapper, keep it as-is to preserve original source
          result[key] = cloneDeep(value);
        } else {
          // Regular object, recursively process
          result[key] = this.preserveOriginalProvenance(
            value,
            fallbackSource,
            includeProvenance,
          );
        }
      } else {
        // For primitives and arrays, wrap with fallback source only if not already wrapped
        const existingSource = this.extractOriginalSource(value);
        if (existingSource) {
          // Already has provenance, keep it
          result[key] = cloneDeep(value);
        } else {
          // No provenance, add fallback source
          result[key] = {
            value: cloneDeep(value),
            source: fallbackSource,
          };
        }
      }
    }
    return result;
  }

  /**
   * Resolve a configuration by merging inheritance chain
   * @param {string} configIdOrName - Configuration ID or name
   * @param {boolean} includeProvenance - Whether to include provenance data
   * @returns {Object} Resolved configuration
   */
  static async resolveConfiguration(configIdOrName, includeProvenance = false) {
    // Find the configuration - try by ID first, then by name
    let config;

    // First try to find by ID
    config = await Configuration.findById(configIdOrName);

    // If not found, try by name
    if (!config) {
      config = await Configuration.findByName(configIdOrName);
    }

    if (!config) {
      throw new Error(`Configuration not found: ${configIdOrName}`);
    }

    // Get the inheritance chain
    const chain = await Configuration.getInheritanceChain(config.id);

    if (chain.length === 0) {
      throw new Error(
        `No inheritance chain found for configuration: ${configIdOrName}`,
      );
    }

    // Start with empty resolved configuration
    let resolved = {};

    // Merge each level in the chain
    for (const level of chain) {
      const source = {
        id: level.id,
        name: level.name,
        type: level.type,
        // Include parent information for VERSION types
        parentName: level.parent_name,
        parentType: level.parent_type,
        // Include user and timestamp information
        createdBy: level.created_by_username || level.created_by,
        createdAt: level.created_at,
        updatedAt: level.updated_at,
      };

      let levelData =
        typeof level.data === "string" ? JSON.parse(level.data) : level.data;

      // If this is a PRODUCT configuration, expand component references
      if (level.type === "PRODUCT") {
        levelData = await this.expandComponentReferences(levelData, includeProvenance);
      }

      // For the first level (root), there's no previous source
      const previousSource = Object.keys(resolved).length === 0 ? null : source;

      resolved = this.deepMergeWithProvenance(
        resolved,
        levelData,
        previousSource,
        source,
        includeProvenance,
      );
    }

    return {
      resolved,
      metadata: {
        configId: config.id,
        configName: config.name,
        configType: config.type,
        chainLength: chain.length,
        chain: chain.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      },
    };
  }

  /**
   * Get value at specific path in resolved configuration
   * @param {string} configIdOrName - Configuration ID or name
   * @param {string} path - Dot-separated path (e.g., "system.logging.level")
   * @returns {Object} Value with provenance
   */
  static async getValueAtPath(configIdOrName, path, minimal = false) {
    const resolved = await this.resolveConfiguration(configIdOrName, true);

    const pathParts = path.split(".");
    let current = resolved.resolved;
    let pathSoFar = [];

    for (const part of pathParts) {
      pathSoFar.push(part);

      if (!current || typeof current !== "object") {
        throw new Error(`Path not found: ${pathSoFar.join(".")}`);
      }

      if (current[part] === undefined) {
        throw new Error(`Path not found: ${pathSoFar.join(".")}`);
      }

      current = current[part];
    }

    if (minimal) {
      // Return just the raw value
      return current;
    }

    // Return with metadata (legacy format)
    return {
      path,
      ...current,
      metadata: resolved.metadata,
    };
  }

  /**
   * Validate that data only contains existing properties from parent
   * @param {Object} data - Data to validate
   * @param {string} parentId - Parent configuration ID
   * @returns {boolean} True if valid
   */
  static async validateSchemaEnforcement(data, parentId) {
    if (!parentId) {
      // Product configurations can define new properties
      return true;
    }

    // If data is empty object, it's always valid (inherits everything from parent)
    if (!data || Object.keys(data).length === 0) {
      return true;
    }

    // Get resolved parent configuration
    const parentResolved = await this.resolveConfiguration(parentId, false);
    const allowedPaths = this.getAllPaths(parentResolved.resolved);
    const providedPaths = this.getAllPaths(data);

    // Check if all provided paths exist in parent
    for (const providedPath of providedPaths) {
      if (!allowedPaths.includes(providedPath)) {
        throw new Error(
          `Property '${providedPath}' not allowed. Parent configuration does not define this property. Available properties: ${allowedPaths.join(", ")}`,
        );
      }
    }

    return true;
  }

  /**
   * Get all possible paths in an object
   * @param {Object} obj - Object to analyze
   * @param {string} prefix - Current path prefix
   * @returns {Array<string>} Array of dot-separated paths
   */
  static getAllPaths(obj, prefix = "") {
    const paths = [];

    if (!isPlainObject(obj)) {
      return prefix ? [prefix] : [];
    }

    for (const [key, value] of Object.entries(obj)) {
      const currentPath = prefix ? `${prefix}.${key}` : key;
      paths.push(currentPath);

      if (isPlainObject(value)) {
        paths.push(...this.getAllPaths(value, currentPath));
      }
    }

    return paths;
  }

  /**
   * Create a new configuration with validation
   */
  static async createConfiguration({
    name,
    type,
    parentId,
    data,
    createdBy,
    description,
  }) {
    // Validate unique name
    const existing = await Configuration.findByName(name);
    if (existing) {
      throw new Error(`Configuration with name '${name}' already exists`);
    }

    // Validate parent relationship
    if (type === "PRODUCT" && parentId) {
      throw new Error("Product configurations cannot have a parent");
    }

    if (type !== "PRODUCT" && type !== "COMPONENT" && !parentId) {
      throw new Error("Instance, User, and Version configurations must have a parent");
    }

    // Validate parent exists and is correct type
    if (parentId) {
      const parent = await Configuration.findById(parentId);
      if (!parent) {
        throw new Error("Parent configuration not found");
      }

      if (type === "INSTANCE" && parent.type !== "PRODUCT") {
        throw new Error("Instance configurations must have a Product parent");
      }

      if (type === "USER" && !["INSTANCE", "USER"].includes(parent.type)) {
        throw new Error(
          "User configurations must have an Instance or User parent",
        );
      }
    }

    // Validate schema enforcement
    if (type !== "PRODUCT") {
      await this.validateSchemaEnforcement(data, parentId);
    }

    // Create the configuration
    return await Configuration.create({
      name,
      type,
      parentId,
      data,
      createdBy,
      description,
    });
  }

  /**
   * Update a configuration with validation
   */
  static async updateConfiguration(configId, { data, description }, updaterId) {
    console.log("=== updateConfiguration called ===");
    console.log("configId received:", configId);
    console.log("configId type:", typeof configId);
    console.log("configId stringified:", JSON.stringify(configId));

    const config = await Configuration.findById(configId);
    if (!config) {
      throw new Error("Configuration not found");
    }

    // Check if user can update
    if (config.type === "USER" && config.status === "COMMITTED") {
      throw new Error("Cannot update committed user configuration");
    }

    // Validate schema enforcement for updates - TEMPORARILY DISABLED FOR INSTANCE
    if (data && config.type !== "PRODUCT" && config.type !== "INSTANCE" && config.parent_id) {
      // Ensure parent_id is a string, not a populated object
      let parentId;
      if (typeof config.parent_id === 'string') {
        parentId = config.parent_id;
      } else if (config.parent_id && typeof config.parent_id === 'object') {
        // Handle populated object case - extract the _id or id field
        parentId = config.parent_id._id || config.parent_id.id || String(config.parent_id);
      } else {
        parentId = String(config.parent_id);
      }

      console.log("validateSchemaEnforcement - original parent_id:", config.parent_id);
      console.log("validateSchemaEnforcement - converted parentId:", parentId);

      await this.validateSchemaEnforcement(data, parentId);
    }

    return await Configuration.update(configId, { data, description });
  }

  /**
   * Commit a user configuration
   */
  static async commitUserConfiguration(configId) {
    const config = await Configuration.findById(configId);
    if (!config) {
      throw new Error("Configuration not found");
    }

    if (config.type !== "USER") {
      throw new Error("Only user configurations can be committed");
    }

    if (config.status === "COMMITTED") {
      throw new Error("Configuration is already committed");
    }

    return await Configuration.commit(configId);
  }

  /**
   * Archive a configuration with its children
   */
  static async archiveConfiguration(configId, archiveChildren = true) {
    const config = await Configuration.findById(configId);
    if (!config) {
      throw new Error("Configuration not found");
    }

    // Check if this is a component or version used by non-archived products
    if (config.type === "COMPONENT" || config.type === "VERSION") {
      await this.validateCanArchive(configId);
    }

    return await Configuration.archive(configId, archiveChildren);
  }

  /**
   * Restore an archived configuration
   */
  static async restoreConfiguration(configId) {
    const config = await Configuration.findById(configId);
    if (!config) {
      throw new Error("Configuration not found");
    }

    if (!config.archived) {
      throw new Error("Configuration is not archived");
    }

    return await Configuration.restore(configId);
  }

  /**
   * Validate that a component/version can be archived
   */
  static async validateCanArchive(configId) {
    // Find all product configurations that might use this component/version
    const products = await Configuration.findByType("PRODUCT");

    for (const product of products) {
      if (product.archived) continue; // Skip archived products

      // Check if this product references the component/version
      if (this.productReferencesConfig(product.data, configId)) {
        const config = await Configuration.findById(configId);
        throw new Error(
          `Cannot archive ${config.type.toLowerCase()} "${config.name}" because it is used by non-archived product "${product.name}"`
        );
      }
    }
  }

  /**
   * Check if product data references a specific configuration
   */
  static productReferencesConfig(productData, configId) {
    if (!productData || typeof productData !== 'object') {
      return false;
    }

    for (const [componentName, reference] of Object.entries(productData)) {
      if (reference && typeof reference === 'object' && reference.versionId === configId) {
        return true;
      }
    }

    return false;
  }

  /**
   * Expand component references in product data
   * @param {Object} productData - Product data containing component references
   * @param {boolean} includeProvenance - Whether to include provenance tracking
   * @returns {Object} Expanded data with resolved component/version data
   */
  static async expandComponentReferences(productData, includeProvenance = false) {
    if (!productData || typeof productData !== 'object') {
      return productData;
    }

    const expandedData = {};

    // Process each component reference
    for (const [componentName, reference] of Object.entries(productData)) {
      try {
        // Check if this is a component reference object
        if (reference && typeof reference === 'object' && reference.versionId) {
          // This is a new-style component reference
          const version = await Configuration.findById(reference.versionId);
          if (version && (version.type === 'VERSION' || version.type === 'COMPONENT')) {
            // Resolve the version/component with its full inheritance chain
            const resolvedVersion = await this.resolveConfiguration(version.id, includeProvenance);

            // Preserve the component reference metadata while including resolved data
            expandedData[componentName] = {
              // Keep the original component reference metadata
              componentId: reference.componentId,
              versionId: reference.versionId,
              componentName: reference.componentName,
              versionName: reference.versionName,
              // Include all resolved properties from the component/version
              ...resolvedVersion.resolved
            };
          } else {
            console.warn(`Version/Component not found for reference:`, reference);
            expandedData[componentName] = {};
          }
        } else {
          // This might be old-style data (actual component data) or other data
          // For backwards compatibility, keep as-is
          expandedData[componentName] = reference;
        }
      } catch (error) {
        console.error(`Error expanding component reference ${componentName}:`, error);
        // Fallback: keep the original value
        expandedData[componentName] = reference;
      }
    }

    return expandedData;
  }
}

module.exports = ConfigurationService;
