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

ruleSchema.statics.findByConfigurationAndPath = function(configurationId, propertyPath) {
  return this.find({ configurationId, propertyPath, enabled: true });
};

ruleSchema.statics.validateValue = async function(configurationId, propertyPath, value) {
  const rules = await this.findByConfigurationAndPath(configurationId, propertyPath);
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
