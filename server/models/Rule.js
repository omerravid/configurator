const { v4: uuidv4 } = require('uuid');

class Rule {
  constructor(db) {
    this.db = db;
  }

  // Create a new rule
  static async create(ruleData) {
    const { db } = require('./database');
    const id = uuidv4();
    
    const query = `
      INSERT INTO rules (id, configuration_id, property_path, rule_type, rule_config, error_message, enabled, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.query(query, [
      id,
      ruleData.configurationId,
      ruleData.propertyPath,
      ruleData.ruleType,
      JSON.stringify(ruleData.ruleConfig),
      ruleData.errorMessage || '',
      ruleData.enabled !== false ? 1 : 0,
      ruleData.created_by
    ]);

    if (result.success) {
      return this.findById(id);
    }
    throw new Error('Failed to create rule');
  }

  // Find rule by ID
  static async findById(id) {
    const { db } = require('./database');
    const result = await db.query('SELECT * FROM rules WHERE id = ?', [id]);
    
    if (result.success && result.rows.length > 0) {
      return this.formatRule(result.rows[0]);
    }
    return null;
  }

  // Find rules by configuration ID
  static async findByConfigurationId(configurationId) {
    const { db } = require('./database');
    const result = await db.query(
      'SELECT * FROM rules WHERE configuration_id = ? ORDER BY property_path',
      [configurationId]
    );
    
    if (result.success) {
      return result.rows.map(this.formatRule);
    }
    return [];
  }

  // Find rules by configuration and path
  static async findByConfigurationAndPath(configurationId, propertyPath) {
    const { db } = require('./database');
    const result = await db.query(
      'SELECT * FROM rules WHERE configuration_id = ? AND property_path = ? AND enabled = 1',
      [configurationId, propertyPath]
    );

    if (result.success) {
      return result.rows.map(this.formatRule);
    }
    return [];
  }

  // Find rules by configuration and path, including inherited rules from parent configurations
  static async findByConfigurationAndPathWithInheritance(configurationId, propertyPath) {
    const { Configuration } = require('./index');

    try {
      // Get the full inheritance chain
      const inheritanceChain = await Configuration.getInheritanceChain(configurationId);

      // Extract configuration IDs from the chain
      const configIds = inheritanceChain.map(config => config.id);

      if (configIds.length === 0) {
        return [];
      }

      // Create placeholders for the IN clause
      const placeholders = configIds.map(() => '?').join(',');

      const { db } = require('./database');
      const result = await db.query(
        `SELECT * FROM rules
         WHERE configuration_id IN (${placeholders})
         AND property_path = ?
         AND enabled = 1
         ORDER BY configuration_id, created_at`,
        [...configIds, propertyPath]
      );

      if (result.success) {
        return result.rows.map(this.formatRule);
      }
      return [];
    } catch (error) {
      console.error('Error finding rules with inheritance:', error);
      // Fallback to just the current configuration
      return this.findByConfigurationAndPath(configurationId, propertyPath);
    }
  }

  // Update rule
  static async update(id, updateData) {
    const { db } = require('./database');
    const setClauses = [];
    const values = [];

    if (updateData.propertyPath !== undefined) {
      setClauses.push('property_path = ?');
      values.push(updateData.propertyPath);
    }
    if (updateData.ruleType !== undefined) {
      setClauses.push('rule_type = ?');
      values.push(updateData.ruleType);
    }
    if (updateData.ruleConfig !== undefined) {
      setClauses.push('rule_config = ?');
      values.push(JSON.stringify(updateData.ruleConfig));
    }
    if (updateData.errorMessage !== undefined) {
      setClauses.push('error_message = ?');
      values.push(updateData.errorMessage);
    }
    if (updateData.enabled !== undefined) {
      setClauses.push('enabled = ?');
      values.push(updateData.enabled ? 1 : 0);
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const query = `UPDATE rules SET ${setClauses.join(', ')} WHERE id = ?`;
    const result = await db.query(query, values);

    if (result.success) {
      return this.findById(id);
    }
    return null;
  }

  // Delete rule
  static async delete(id) {
    const { db } = require('./database');
    const result = await db.query('DELETE FROM rules WHERE id = ?', [id]);
    return result.success;
  }

  // Delete all rules for a configuration
  static async deleteByConfigurationId(configurationId) {
    const { db } = require('./database');
    const result = await db.query('DELETE FROM rules WHERE configuration_id = ?', [configurationId]);
    return result.success;
  }

  // Validate value against rules
  static async validateValue(configurationId, propertyPath, value) {
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
  }

  // Validate single rule
  static validateSingleRule(rule, value) {
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
  }

  // Validate numeric rule
  static validateNumericRule(config, value) {
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
  }

  // Validate pattern rule
  static validatePatternRule(config, value) {
    try {
      const { pattern, flags = '' } = config;
      const regex = new RegExp(pattern, flags);
      return regex.test(String(value));
    } catch (error) {
      console.error('Invalid regex pattern:', error);
      return false;
    }
  }

  // Validate collection rule
  static validateCollectionRule(config, value) {
    const { validValues } = config;
    if (!Array.isArray(validValues)) return false;
    return validValues.includes(value);
  }

  // Format rule from database
  static formatRule(row) {
    return {
      id: row.id,
      configurationId: row.configuration_id,
      propertyPath: row.property_path,
      ruleType: row.rule_type,
      ruleConfig: JSON.parse(row.rule_config),
      errorMessage: row.error_message,
      enabled: Boolean(row.enabled),
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

module.exports = Rule;
