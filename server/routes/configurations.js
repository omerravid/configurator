const express = require("express");
const Joi = require("joi");
const Configuration = require("../models/Configuration");
const ConfigurationService = require("../services/ConfigurationService");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

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
      if (config.created_by !== req.user.id) {
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
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { type, status } = req.query;

    let configs;
    if (type) {
      configs = await Configuration.findByType(type);
    } else {
      configs = await Configuration.findAll();
    }

    // Filter by status if specified
    if (status) {
      configs = configs.filter((config) => config.status === status);
    }

    // Non-admin users can only see their own USER configs
    if (req.user.role !== "ADMIN") {
      configs = configs.filter(
        (config) => config.type !== "USER" || config.created_by === req.user.id,
      );
    }

    res.json({ configs });
  } catch (error) {
    console.error("List configurations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/configs/components - Get all components with their versions
router.get("/components", authenticateToken, async (req, res) => {
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
    console.log("Received create configuration request:", req.body);
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
      createdBy: req.user.id,
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
router.get("/:id", authenticateToken, async (req, res) => {
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

      res.json({
        resolved: config.data,
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
      res.json(result);
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
      // Validate input
      const { error, value } = updateConfigSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }

      const config = await ConfigurationService.updateConfiguration(
        req.params.id,
        value,
        req.user.id,
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

// GET /api/configs/:id/data - Get specific path from resolved configuration
router.get("/:id/data", authenticateToken, async (req, res) => {
  try {
    const { path } = req.query;

    if (!path || path.trim() === "") {
      // If no path provided, return the complete resolved configuration
      const result = await ConfigurationService.resolveConfiguration(
        req.params.id,
        true,
      );
      return res.json({ data: result.resolved, metadata: result.metadata });
    }

    const result = await ConfigurationService.getValueAtPath(
      req.params.id,
      path,
    );

    res.json({ data: result });
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
router.get("/:id/children", authenticateToken, async (req, res) => {
  try {
    const children = await Configuration.findByParentId(req.params.id);

    // Filter user configs for non-admin users
    const filteredChildren =
      req.user.role === "ADMIN"
        ? children
        : children.filter(
            (child) =>
              child.type !== "USER" || child.created_by === req.user.id,
          );

    res.json({ children: filteredChildren });
  } catch (error) {
    console.error("Get children error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
