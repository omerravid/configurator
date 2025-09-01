const express = require("express");
const Joi = require("joi");
const { Configuration } = require("../models");
const ConfigurationService = require("../services/ConfigurationService");
const { authenticateToken, authenticateTokenOrApiKey, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Validation schemas - Fixed to not require GUID format for parent_id
const createConfigSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  type: Joi.string()
    .valid("PRODUCT", "INSTANCE", "USER", "COMPONENT", "VERSION")
    .required(),
  parent_id: Joi.alternatives()
    .try(
      Joi.string().min(1), // Accept any non-empty string
      Joi.allow(null, ""), // Allow null or empty string
    )
    .optional(),
  data: Joi.object().required(),
  description: Joi.alternatives()
    .try(Joi.string().max(500), Joi.allow("", null))
    .optional(),
});

const updateConfigSchema = Joi.object({
  data: Joi.object().optional(),
  description: Joi.alternatives()
    .try(Joi.string().max(500), Joi.allow("", null))
    .optional(),
}).min(1);

const renameConfigSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
});

// Middleware to check permissions for config operations
const checkConfigPermissions = async (req, res, next) => {
  try {
    const config = await Configuration.findById(req.params.id);
    if (!config) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    req.config = config;

    // Admin can do anything
    if (req.user.role === "ADMIN") {
      return next();
    }

    // For non-admin users
    if (
      config.type === "PRODUCT" ||
      config.type === "INSTANCE" ||
      config.type === "COMPONENT"
    ) {
      return res.status(403).json({
        error:
          "Only admins can modify Product/Instance/Component configurations",
      });
    }

    // For USER and VERSION configs, check ownership and draft status
    if (config.type === "USER" || config.type === "VERSION") {
      if (config.created_by !== req.user.username) {
        return res
          .status(403)
          .json({ error: "You can only modify your own configurations" });
      }

      if (req.method !== "GET" && config.status === "COMMITTED") {
        return res
          .status(403)
          .json({ error: "Cannot modify committed configurations" });
      }
    }

    next();
  } catch (error) {
    console.error("Permission check error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/configs - List all configurations
router.get("/", authenticateTokenOrApiKey, async (req, res) => {
  try {
    const { type, status, includeArchived } = req.query;
    const showArchived = includeArchived === 'true';

    let configs;
    if (type) {
      configs = await Configuration.findByType(type);
    } else {
      configs = await Configuration.findAll(showArchived);
    }

    // Filter by status if specified
    if (status) {
      configs = configs.filter((config) => config.status === status);
    }

    // Non-admin users can only see their own USER configs
    if (req.user.role !== "ADMIN") {
      configs = configs.filter((config) => {
        if (config.type !== "USER") {
          return true; // Include non-USER configs
        }

        return config.created_by === req.user.username;
      });
    }

    res.json({ configs });
  } catch (error) {
    console.error("List configurations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/configs/components - Get all components with their versions
router.get("/components", authenticateTokenOrApiKey, async (req, res) => {
  try {
    const components = await Configuration.findByType("COMPONENT");

    // Get versions for each component (including component as root version)
    const componentsWithVersions = await Promise.all(
      components.map(async (component) => {
        const childVersions = await Configuration.findByParentId(component.id);

        // Include the component itself as the root version, plus any child versions
        const allVersions = [
          {
            ...component,
            name: `${component.name} (root)`,
            isRoot: true,
          },
          ...childVersions.filter((v) => v.type === "VERSION"),
        ];

        return {
          ...component,
          versions: allVersions,
        };
      }),
    );

    res.json({ components: componentsWithVersions });
  } catch (error) {
    console.error("List components error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/configs - Create new configuration
router.post("/", authenticateToken, async (req, res) => {
  try {
    // Validate input
    const { error, value } = createConfigSchema.validate(req.body);
    if (error) {
      console.error("Validation error:", error.details);
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name, type, parent_id, data, description } = value;

    // Check permissions
    if (
      (type === "PRODUCT" || type === "INSTANCE" || type === "COMPONENT") &&
      req.user.role !== "ADMIN"
    ) {
      return res.status(403).json({
        error:
          "Only admins can create Product/Instance/Component configurations",
      });
    }

    // Clean up parent_id - convert empty string to null
    const cleanParentId =
      parent_id && parent_id.trim() !== "" ? parent_id : null;


    // Create configuration using service
    const config = await ConfigurationService.createConfiguration({
      name,
      type,
      parentId: cleanParentId,
      data,
      createdBy: req.user.username,
      description: description || "",
    });

    res.status(201).json({
      message: "Configuration created successfully",
      config,
    });
  } catch (error) {
    console.error("Create configuration error:", error);

    if (
      error.message.includes("already exists") ||
      error.message.includes("not allowed")
    ) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/configs/:id - Get resolved configuration
router.get("/:id", authenticateTokenOrApiKey, async (req, res) => {
  try {
    const { provenance, raw } = req.query;
    const includeProvenance = provenance === "true";
    const getRawData = raw === "true";

    if (getRawData) {
      // Return just the raw configuration data for this specific level
      const config = await Configuration.findById(req.params.id);
      if (!config) {
        return res.status(404).json({ error: "Configuration not found" });
      }

      // Fix file URLs in raw data
      const fixedData = await ConfigurationService.fixFileUrls(config.data);

      res.json({
        resolved: fixedData,
        metadata: {
          configId: config.id,
          configName: config.name,
          configType: config.type,
          isRawData: true,
        },
      });
    } else {
      // Return resolved configuration with inheritance
      const result = await ConfigurationService.resolveConfiguration(
        req.params.id,
        includeProvenance,
      );

      // Fix file URLs in resolved data
      const fixedResult = {
        ...result,
        resolved: await ConfigurationService.fixFileUrls(result.resolved)
      };

      res.json(fixedResult);
    }
  } catch (error) {
    console.error("Get configuration error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/configs/:id - Update configuration
router.put(
  "/:id",
  authenticateToken,
  checkConfigPermissions,
  async (req, res) => {
    try {
      console.log("=== PUT /api/configs/:id called ===");
      console.log("req.params.id:", req.params.id);
      console.log("req.params.id type:", typeof req.params.id);
      console.log("req.body:", req.body);

      // Validate input
      const { error, value } = updateConfigSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const config = await ConfigurationService.updateConfiguration(
        req.params.id,
        value,
        req.user.username,
      );

      res.json({
        message: "Configuration updated successfully",
        config,
      });
    } catch (error) {
      console.error("Update configuration error:", error);

      if (
        error.message.includes("not allowed") ||
        error.message.includes("Cannot update")
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// PUT /api/configs/:id/rename - Rename configuration (admin only)
router.put("/:id/rename", authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Validate input
    const { error, value } = renameConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { name } = value;

    // Check if new name already exists
    const existing = await Configuration.findByName(name);
    if (existing && existing.id !== req.params.id) {
      return res
        .status(400)
        .json({ error: "Configuration with this name already exists" });
    }

    // Update the configuration name
    await Configuration.updateName(req.params.id, name);

    const updatedConfig = await Configuration.findById(req.params.id);

    res.json({
      message: "Configuration renamed successfully",
      config: updatedConfig,
    });
  } catch (error) {
    console.error("Rename configuration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/configs/:id - Delete configuration
router.delete("/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deletedConfig = await Configuration.delete(req.params.id);

    if (!deletedConfig) {
      return res.status(404).json({ error: "Configuration not found" });
    }

    res.json({
      message: "Configuration deleted successfully",
      config: deletedConfig,
    });
  } catch (error) {
    console.error("Delete configuration error:", error);

    if (error.message.includes("Cannot delete")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/configs/by-name/:name/data - Get specific path from resolved configuration by name
router.get("/by-name/:name/data", authenticateTokenOrApiKey, async (req, res) => {
  try {
    const { path, minimal } = req.query;
    const isMinimal = minimal === "true";

    // Decode the configuration name from URL encoding
    const configName = decodeURIComponent(req.params.name);
    console.log(`Looking for configuration by name: "${configName}" (original param: "${req.params.name}")`);

    // First find the configuration by name
    const config = await Configuration.findByName(configName);
    if (!config) {
      console.log(`Configuration not found with name: "${configName}"`);

      // Debug: List all available configuration names
      try {
        const allConfigs = await Configuration.findAll(false);
        console.log(`Available configurations (${allConfigs.length}):`);
        allConfigs.forEach((c, index) => {
          console.log(`  ${index + 1}. "${c.name}" (Type: ${c.type})`);
        });
      } catch (debugError) {
        console.log(`Error listing configurations for debug: ${debugError.message}`);
      }

      return res.status(404).json({ error: "Configuration not found" });
    }

    console.log(`Found configuration: "${config.name}" (ID: ${config.id})`);

    if (!path || path.trim() === "") {
      // If no path provided, return the complete configuration
      if (isMinimal) {
        // For minimal requests, return raw config data without inheritance
        console.log(`Minimal request for full config - returning raw data for: ${config.name}`);
        const rawData = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
        const fixedRawData = await ConfigurationService.fixFileUrls(rawData);
        return res.json(fixedRawData);
      } else {
        // For non-minimal requests, resolve with full inheritance
        const result = await ConfigurationService.resolveConfiguration(
          config.id,
          true, // Include provenance for non-minimal
        );

        // Fix file URLs in resolved data
        const fixedResolved = await ConfigurationService.fixFileUrls(result.resolved);
        return res.json({ data: fixedResolved, metadata: result.metadata });
      }
    }

    console.log(`Getting value at path: "${path}" for config: "${config.name}" (ID: ${config.id}), minimal: ${isMinimal}`);
    console.log(`Calling getValueAtPath with configId: "${config.id}", path: "${path}", minimal: ${isMinimal}`);

    const result = await ConfigurationService.getValueAtPath(
      config.id,
      path,
      isMinimal
    );

    console.log(`getValueAtPath completed successfully, result type: ${typeof result}`);

    console.log(`getValueAtPath returned:`, typeof result, result);

    // Fix file URLs in path result
    const fixedResult = await ConfigurationService.fixFileUrls(result);

    console.log(`After fixFileUrls:`, typeof fixedResult, fixedResult);

    if (isMinimal) {
      // Return just the value (already minimal from service)
      console.log(`Returning minimal result:`, fixedResult);
      res.json(fixedResult);
    } else {
      console.log(`Returning non-minimal result:`, { data: fixedResult });
      res.json({ data: fixedResult });
    }
  } catch (error) {
    console.error("Get configuration path by name error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/configs/:id/data - Get specific path from resolved configuration
router.get("/:id/data", authenticateTokenOrApiKey, async (req, res) => {
  try {
    const { path, minimal } = req.query;
    const isMinimal = minimal === "true";


    if (!path || path.trim() === "") {
      // If no path provided, return the complete resolved configuration
      const result = await ConfigurationService.resolveConfiguration(
        req.params.id,
        !isMinimal, // Include provenance only if not minimal
      );

      // Fix file URLs in resolved data
      const fixedResolved = await ConfigurationService.fixFileUrls(result.resolved);

      if (isMinimal) {
        // Return just the resolved data with no metadata
        return res.json(fixedResolved);
      } else {
        return res.json({ data: fixedResolved, metadata: result.metadata });
      }
    }

    const result = await ConfigurationService.getValueAtPath(
      req.params.id,
      path,
      isMinimal
    );

    // Fix file URLs in path result
    const fixedResult = await ConfigurationService.fixFileUrls(result);

    if (isMinimal) {
      // Return just the value (already minimal from service)
      res.json(fixedResult);
    } else {
      res.json({ data: fixedResult });
    }
  } catch (error) {
    console.error("Get configuration path error:", error);

    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/configs/:id/commit - Commit user configuration
router.post(
  "/:id/commit",
  authenticateToken,
  checkConfigPermissions,
  async (req, res) => {
    try {
      const config = await ConfigurationService.commitUserConfiguration(
        req.params.id,
      );

      res.json({
        message: "Configuration committed successfully",
        config,
      });
    } catch (error) {
      console.error("Commit configuration error:", error);

      if (
        error.message.includes("not found") ||
        error.message.includes("Only user") ||
        error.message.includes("already committed")
      ) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// GET /api/configs/:id/children - Get child configurations
router.get("/:id/children", authenticateTokenOrApiKey, async (req, res) => {
  try {
    const { includeArchived } = req.query;
    const children = await Configuration.findByParentId(req.params.id, includeArchived === 'true');

    // Filter user configs for non-admin users
    const filteredChildren =
      req.user.role === "ADMIN"
        ? children
        : children.filter(
            (child) =>
              child.type !== "USER" || child.created_by === req.user.username,
          );

    res.json({
      children: filteredChildren,
      count: filteredChildren.length
    });
  } catch (error) {
    console.error("Get children error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/configs/:id/archive - Archive configuration
router.post("/:id/archive", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { archiveChildren = true } = req.body;

    const config = await ConfigurationService.archiveConfiguration(
      req.params.id,
      archiveChildren
    );

    res.json({
      message: "Configuration archived successfully",
      config,
    });
  } catch (error) {
    console.error("Archive configuration error:", error);

    if (error.message.includes("not found") || error.message.includes("Cannot archive")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/configs/:id/restore - Restore archived configuration
router.post("/:id/restore", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const config = await ConfigurationService.restoreConfiguration(req.params.id);

    res.json({
      message: "Configuration restored successfully",
      config,
    });
  } catch (error) {
    console.error("Restore configuration error:", error);

    if (error.message.includes("not found") || error.message.includes("not archived")) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
