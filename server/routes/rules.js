const express = require("express");
const Joi = require("joi");
const { Rule } = require("../models");
const { authenticateToken, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Validation schemas
const createRuleSchema = Joi.object({
  configurationId: Joi.string().required(),
  propertyPath: Joi.string().min(1).required(),
  ruleType: Joi.string().valid('numeric', 'pattern', 'collection').required(),
  ruleConfig: Joi.object().required(),
  errorMessage: Joi.string().allow('').optional(),
  enabled: Joi.boolean().default(true)
});

const updateRuleSchema = Joi.object({
  propertyPath: Joi.string().min(1).optional(),
  ruleType: Joi.string().valid('numeric', 'pattern', 'collection').optional(),
  ruleConfig: Joi.object().optional(),
  errorMessage: Joi.string().allow('').optional(),
  enabled: Joi.boolean().optional()
}).min(1);

const validateValueSchema = Joi.object({
  configurationId: Joi.string().required(),
  propertyPath: Joi.string().min(1).required(),
  value: Joi.any().required()
});

// GET /api/rules - List all rules for a configuration
router.get("/", authenticateToken, async (req, res) => {
  try {
    const { configurationId } = req.query;
    
    if (!configurationId) {
      return res.status(400).json({ error: "configurationId is required" });
    }

    const rules = await Rule.findByConfigurationId(configurationId);
    res.json({ rules });
  } catch (error) {
    console.error("Failed to fetch rules:", error);
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

// POST /api/rules - Create new rule
router.post("/", authenticateToken, async (req, res) => {
  try {
    // Validate input
    const { error, value } = createRuleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Validate rule configuration based on type
    const configValidation = validateRuleConfig(value.ruleType, value.ruleConfig);
    if (!configValidation.isValid) {
      return res.status(400).json({ error: configValidation.error });
    }

    // Create rule
    const rule = await Rule.create({
      ...value,
      created_by: req.user.username
    });

    res.status(201).json({ rule });
  } catch (error) {
    console.error("Failed to create rule:", error);
    res.status(500).json({ error: "Failed to create rule" });
  }
});

// GET /api/rules/:id - Get rule by ID
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    const rule = await Rule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    res.json({ rule });
  } catch (error) {
    console.error("Failed to fetch rule:", error);
    res.status(500).json({ error: "Failed to fetch rule" });
  }
});

// PUT /api/rules/:id - Update rule
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    // Validate input
    const { error, value } = updateRuleSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Check if rule exists
    const existingRule = await Rule.findById(req.params.id);
    if (!existingRule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    // Validate rule configuration if provided
    if (value.ruleType || value.ruleConfig) {
      const ruleType = value.ruleType || existingRule.ruleType;
      const ruleConfig = value.ruleConfig || existingRule.ruleConfig;
      
      const configValidation = validateRuleConfig(ruleType, ruleConfig);
      if (!configValidation.isValid) {
        return res.status(400).json({ error: configValidation.error });
      }
    }

    // Update rule
    const updatedRule = await Rule.update(req.params.id, value);
    if (!updatedRule) {
      return res.status(500).json({ error: "Failed to update rule" });
    }

    res.json({ rule: updatedRule });
  } catch (error) {
    console.error("Failed to update rule:", error);
    res.status(500).json({ error: "Failed to update rule" });
  }
});

// DELETE /api/rules/:id - Delete rule
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const rule = await Rule.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: "Rule not found" });
    }

    const success = await Rule.delete(req.params.id);
    if (!success) {
      return res.status(500).json({ error: "Failed to delete rule" });
    }

    res.json({ message: "Rule deleted successfully" });
  } catch (error) {
    console.error("Failed to delete rule:", error);
    res.status(500).json({ error: "Failed to delete rule" });
  }
});

// POST /api/rules/validate - Validate value against rules
router.post("/validate", authenticateToken, async (req, res) => {
  try {
    // Validate input
    const { error, value } = validateValueSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Validate value against rules
    const validation = await Rule.validateValue(
      value.configurationId,
      value.propertyPath,
      value.value
    );

    res.json(validation);
  } catch (error) {
    console.error("Failed to validate value:", error);
    res.status(500).json({ error: "Failed to validate value" });
  }
});

// GET /api/rules/configuration/:configId/path/:path - Get rules for specific path
router.get("/configuration/:configId/path/:path(*)", authenticateToken, async (req, res) => {
  try {
    const { configId, path } = req.params;
    const decodedPath = decodeURIComponent(path);
    
    const rules = await Rule.findByConfigurationAndPath(configId, decodedPath);
    res.json({ rules });
  } catch (error) {
    console.error("Failed to fetch rules for path:", error);
    res.status(500).json({ error: "Failed to fetch rules for path" });
  }
});

// Helper function to validate rule configuration
function validateRuleConfig(ruleType, ruleConfig) {
  switch (ruleType) {
    case 'numeric':
      return validateNumericConfig(ruleConfig);
    case 'pattern':
      return validatePatternConfig(ruleConfig);
    case 'collection':
      return validateCollectionConfig(ruleConfig);
    default:
      return { isValid: false, error: "Invalid rule type" };
  }
}

function validateNumericConfig(config) {
  const schema = Joi.object({
    operator: Joi.string().valid('greater', 'smaller', 'equals', 'greaterEquals', 'smallerEquals').required(),
    value: Joi.number().required()
  });

  const { error } = schema.validate(config);
  return {
    isValid: !error,
    error: error ? error.details[0].message : null
  };
}

function validatePatternConfig(config) {
  const schema = Joi.object({
    pattern: Joi.string().required(),
    flags: Joi.string().allow('').optional()
  });

  const { error } = schema.validate(config);
  if (error) {
    return {
      isValid: false,
      error: error.details[0].message
    };
  }

  // Test if regex pattern is valid
  try {
    new RegExp(config.pattern, config.flags || '');
    return { isValid: true };
  } catch (regexError) {
    return {
      isValid: false,
      error: "Invalid regex pattern: " + regexError.message
    };
  }
}

function validateCollectionConfig(config) {
  const schema = Joi.object({
    validValues: Joi.array().items(Joi.any()).min(1).required()
  });

  const { error } = schema.validate(config);
  return {
    isValid: !error,
    error: error ? error.details[0].message : null
  };
}

module.exports = router;
