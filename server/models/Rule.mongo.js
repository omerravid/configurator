const mongoose = require('mongoose');

const ruleSchema = new mongoose.Schema({
  configurationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Configuration',
    required: true
  },
  propertyPath: {
    type: String,
    required: true,
    trim: true
  },
  ruleType: {
    type: String,
    enum: ['numeric', 'pattern', 'collection'],
    required: true
  },
  ruleConfig: {
    // For numeric rules: { operator: 'greater|smaller|equals', value: number }
    // For pattern rules: { pattern: string, flags: string }
    // For collection rules: { validValues: array }
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  errorMessage: {
    type: String,
    default: ''
  },
  enabled: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: String,
    required: true
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.created_at = ret.createdAt;
      ret.updated_at = ret.updatedAt;
      delete ret._id;
      delete ret.__v;
      delete ret.createdAt;
      delete ret.updatedAt;
      return ret;
    }
  }
});

// Indexes for better performance
ruleSchema.index({ configurationId: 1, propertyPath: 1 });
ruleSchema.index({ configurationId: 1 });
ruleSchema.index({ enabled: 1 });

// Static methods
ruleSchema.statics.findByConfigurationId = function(configurationId) {
  return this.find({ configurationId }).sort({ propertyPath: 1 });
};

// Create new rule
ruleSchema.statics.create = async function(ruleData) {
  try {
    const rule = new this(ruleData);
    return await rule.save();
  } catch (error) {
    console.error('Failed to create rule:', error);
    throw error;
  }
};

// Find rule by ID
ruleSchema.statics.findById = function(id) {
  return this.findOne({ _id: id });
};

ruleSchema.statics.findByConfigurationAndPath = function(configurationId, propertyPath) {
  return this.find({ configurationId, propertyPath, enabled: true });
};

// Find rules by configuration and path, including inherited rules from parent configurations
ruleSchema.statics.findByConfigurationAndPathWithInheritance = async function(configurationId, propertyPath) {
  const { Configuration } = require('./index');

  try {
    console.log("=== RULE INHERITANCE DEBUG ===");
    console.log("Looking for rules for configId:", configurationId, "path:", propertyPath);

    // Get the full inheritance chain
    const inheritanceChain = await Configuration.getInheritanceChain(configurationId);
    console.log("Inheritance chain:", inheritanceChain.map(c => ({ id: c.id || c._id, name: c.name, type: c.type })));

    // Extract configuration IDs from the chain
    const configIds = inheritanceChain.map(config => config.id || config._id);
    console.log("Config IDs to search for rules:", configIds);

    // Additional logic for instances and products: also check component references
    const allConfigIds = [...configIds];

    // For each configuration in the chain, check if it has component references
    for (const config of inheritanceChain) {
      if (config.data && typeof config.data === 'object') {
        // Look for component references in the data
        const pathParts = propertyPath.split('.');
        if (pathParts.length > 0) {
          const componentName = pathParts[0]; // e.g., "Battery" from "Battery.charging.maxWatts"

          if (config.data[componentName] && config.data[componentName].componentId) {
            const componentRef = config.data[componentName];
            console.log(`Found component reference in ${config.name}:`, componentRef);

            // Add the referenced component and version to our search
            if (componentRef.componentId) {
              allConfigIds.push(componentRef.componentId);
              console.log("Added componentId:", componentRef.componentId);
            }
            if (componentRef.versionId && componentRef.versionId !== componentRef.componentId) {
              allConfigIds.push(componentRef.versionId);
              console.log("Added versionId:", componentRef.versionId);
            }
          }
        }
      }
    }

    // Remove duplicates
    const uniqueConfigIds = [...new Set(allConfigIds)];
    console.log("Final unique config IDs to search:", uniqueConfigIds);

    // Find rules from all configurations in the inheritance chain and referenced components
    const rules = await this.find({
      configurationId: { $in: uniqueConfigIds },
      propertyPath,
      enabled: true
    }).sort({ configurationId: 1 }); // Sort to apply rules from root to current

    console.log("Found rules:", rules.map(r => ({ id: r.id, configId: r.configurationId, type: r.ruleType, config: r.ruleConfig })));

    return rules;
  } catch (error) {
    console.error('Error finding rules with inheritance:', error);
    // Fallback to just the current configuration
    return this.findByConfigurationAndPath(configurationId, propertyPath);
  }
};

// Update rule by ID
ruleSchema.statics.update = async function(id, updateData) {
  try {
    const updatedRule = await this.findByIdAndUpdate(
      id,
      {
        ...updateData,
        updatedAt: new Date()
      },
      {
        new: true,  // Return the updated document
        runValidators: true  // Run schema validators
      }
    );
    return updatedRule;
  } catch (error) {
    console.error('Failed to update rule:', error);
    return null;
  }
};

// Delete rule by ID
ruleSchema.statics.delete = async function(id) {
  try {
    const result = await this.findByIdAndDelete(id);
    return result !== null;
  } catch (error) {
    console.error('Failed to delete rule:', error);
    return false;
  }
};

// Delete all rules for a configuration
ruleSchema.statics.deleteByConfigurationId = async function(configurationId) {
  try {
    const result = await this.deleteMany({ configurationId });
    return true;
  } catch (error) {
    console.error('Failed to delete rules by configuration ID:', error);
    return false;
  }
};

ruleSchema.statics.validateValue = async function(configurationId, propertyPath, value) {
  // Use inheritance-aware rule finding to check rules from parent configurations too
  const rules = await this.findByConfigurationAndPathWithInheritance(configurationId, propertyPath);
  const errors = [];

  for (const rule of rules) {
    const isValid = this.validateSingleRule(rule, value);
    if (!isValid) {
      errors.push(rule.errorMessage || `Value does not satisfy ${rule.ruleType} rule`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

ruleSchema.statics.validateSingleRule = function(rule, value) {
  switch (rule.ruleType) {
    case 'numeric':
      return this.validateNumericRule(rule.ruleConfig, value);
    case 'pattern':
      return this.validatePatternRule(rule.ruleConfig, value);
    case 'collection':
      return this.validateCollectionRule(rule.ruleConfig, value);
    default:
      return false;
  }
};

ruleSchema.statics.validateNumericRule = function(config, value) {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return false;

  const { operator, value: ruleValue } = config;
  const ruleNum = parseFloat(ruleValue);

  switch (operator) {
    case 'greater':
      return numValue > ruleNum;
    case 'smaller':
      return numValue < ruleNum;
    case 'equals':
      return numValue === ruleNum;
    case 'greaterEquals':
      return numValue >= ruleNum;
    case 'smallerEquals':
      return numValue <= ruleNum;
    default:
      return false;
  }
};

ruleSchema.statics.validatePatternRule = function(config, value) {
  try {
    const { pattern, flags = '' } = config;
    const regex = new RegExp(pattern, flags);
    return regex.test(String(value));
  } catch (error) {
    console.error('Invalid regex pattern:', error);
    return false;
  }
};

ruleSchema.statics.validateCollectionRule = function(config, value) {
  const { validValues } = config;
  if (!Array.isArray(validValues)) return false;
  return validValues.includes(value);
};

const Rule = mongoose.model('Rule', ruleSchema);

module.exports = Rule;
