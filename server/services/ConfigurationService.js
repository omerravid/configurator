const Configuration = require("../models/Configuration");
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
          // For inherited objects, recursively add provenance
          finalValue = this.addProvenanceToObject(
            baseValue,
            baseSource,
            includeProvenance,
          );
        } else {
          finalValue = cloneDeep(baseValue);
        }
        finalSource = baseSource;
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
      };

      const levelData =
        typeof level.data === "string" ? JSON.parse(level.data) : level.data;

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
  static async getValueAtPath(configIdOrName, path) {
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
    const config = await Configuration.findById(configId);
    if (!config) {
      throw new Error("Configuration not found");
    }

    // Check if user can update
    if (config.type === "USER" && config.status === "COMMITTED") {
      throw new Error("Cannot update committed user configuration");
    }

    // Validate schema enforcement for updates
    if (data && config.type !== "PRODUCT" && config.parent_id) {
      await this.validateSchemaEnforcement(data, config.parent_id);
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
}

module.exports = ConfigurationService;
