const mongoose = require('mongoose');

const configurationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['PRODUCT', 'INSTANCE', 'USER', 'COMPONENT', 'VERSION'],
    required: true
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Configuration',
    default: null
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['DRAFT', 'COMMITTED'],
    default: 'COMMITTED'
  },
  archived: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id.toString();
      ret.created_at = ret.createdAt;
      ret.updated_at = ret.updatedAt;
      if (ret.parent_id) {
        ret.parent_id = ret.parent_id.toString();
      }
      if (ret.created_by) {
        ret.created_by = ret.created_by.toString();
      }
      delete ret._id;
      delete ret.__v;
      delete ret.createdAt;
      delete ret.updatedAt;
      return ret;
    }
  }
});

// Indexes for better performance
configurationSchema.index({ name: 1 });
configurationSchema.index({ type: 1 });
configurationSchema.index({ parent_id: 1 });
configurationSchema.index({ created_by: 1 });

const ConfigurationModel = mongoose.model('Configuration', configurationSchema);

class Configuration {
  static async create({
    name,
    type,
    parentId,
    data,
    createdBy,
    description,
    status,
    archived = false,
  }) {
    // Set status: USER configs default to DRAFT (unless explicitly set), others are COMMITTED
    const finalStatus =
      type === "USER" || type === "VERSION" ? status || "DRAFT" : "COMMITTED";

    const configuration = new ConfigurationModel({
      name,
      type,
      parent_id: parentId || null,
      data: data || {},
      created_by: createdBy,
      description: description || '',
      status: finalStatus,
      archived: archived
    });

    const savedConfig = await configuration.save();
    return await this.findById(savedConfig._id);
  }

  static generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  static async findById(id) {
    const config = await ConfigurationModel.findById(id)
      .populate('created_by', 'username')
      .populate('parent_id', 'name type');

    if (!config) return null;

    const result = config.toJSON();
    
    // Add populated fields in expected format
    if (config.created_by) {
      result.created_by_username = config.created_by.username;
    }
    if (config.parent_id) {
      result.parent_name = config.parent_id.name;
      result.parent_type = config.parent_id.type;
    }

    return result;
  }

  static async findByName(name) {
    const config = await ConfigurationModel.findOne({ name })
      .populate('created_by', 'username')
      .populate('parent_id', 'name type');

    if (!config) return null;

    const result = config.toJSON();
    
    // Add populated fields in expected format
    if (config.created_by) {
      result.created_by_username = config.created_by.username;
    }
    if (config.parent_id) {
      result.parent_name = config.parent_id.name;
      result.parent_type = config.parent_id.type;
    }

    return result;
  }

  static async findAll(includeArchived = false) {
    const filter = includeArchived ? {} : { archived: { $ne: true } };
    const configs = await ConfigurationModel.find(filter)
      .populate('created_by', 'username')
      .populate('parent_id', 'name type')
      .sort({ type: 1, createdAt: -1 });

    return configs.map(config => {
      const result = config.toJSON();
      
      // Add populated fields in expected format
      if (config.created_by) {
        result.created_by_username = config.created_by.username;
      }
      if (config.parent_id) {
        result.parent_name = config.parent_id.name;
        result.parent_type = config.parent_id.type;
      }

      return result;
    });
  }

  static async findByType(type) {
    const configs = await ConfigurationModel.find({ type })
      .populate('created_by', 'username')
      .populate('parent_id', 'name type')
      .sort({ createdAt: -1 });

    return configs.map(config => {
      const result = config.toJSON();
      
      // Add populated fields in expected format
      if (config.created_by) {
        result.created_by_username = config.created_by.username;
      }
      if (config.parent_id) {
        result.parent_name = config.parent_id.name;
        result.parent_type = config.parent_id.type;
      }

      return result;
    });
  }

  static async findByParentId(parentId, includeArchived = false) {
    const filter = { parent_id: parentId };
    if (!includeArchived) {
      filter.archived = { $ne: true };
    }
    const configs = await ConfigurationModel.find(filter)
      .populate('created_by', 'username')
      .sort({ type: 1, createdAt: -1 });

    return configs.map(config => {
      const result = config.toJSON();
      
      // Add populated fields in expected format
      if (config.created_by) {
        result.created_by_username = config.created_by.username;
      }

      return result;
    });
  }

  static async getInheritanceChain(configId) {
    const chain = [];
    let currentId = configId;

    while (currentId) {
      const config = await ConfigurationModel.findById(currentId)
        .populate('parent_id', 'name type');

      if (!config) break;

      const result = config.toJSON();
      
      if (config.parent_id) {
        result.parent_name = config.parent_id.name;
        result.parent_type = config.parent_id.type;
      }

      chain.push(result);
      currentId = config.parent_id ? config.parent_id._id : null;
    }

    // Reverse to get root first
    return chain.reverse();
  }

  static async update(id, { data, description }) {
    // Ensure ID is a string
    const configId = String(id);

    const updateFields = {};

    if (data !== undefined) {
      updateFields.data = data;
    }

    if (description !== undefined) {
      updateFields.description = description;
    }

    if (Object.keys(updateFields).length === 0) {
      throw new Error("No fields to update");
    }

    await ConfigurationModel.findByIdAndUpdate(configId, updateFields, { new: true });
    return await this.findById(configId);
  }

  static async updateName(id, name) {
    await ConfigurationModel.findByIdAndUpdate(id, { name }, { new: true });
    return await this.findById(id);
  }

  static async commit(id) {
    const config = await ConfigurationModel.findById(id);
    
    if (!config) {
      throw new Error('Configuration not found');
    }

    if (!['USER', 'VERSION'].includes(config.type) || config.status !== 'DRAFT') {
      throw new Error('Only draft USER or VERSION configurations can be committed');
    }

    await ConfigurationModel.findByIdAndUpdate(id, { status: 'COMMITTED' }, { new: true });
    return await this.findById(id);
  }

  static async archive(id, archiveChildren = false) {
    const config = await this.findById(id);
    if (!config) {
      throw new Error("Configuration not found");
    }

    if (archiveChildren) {
      // Recursively archive all children
      await this.archiveWithChildren(id);
    } else {
      // Just archive this configuration
      await ConfigurationModel.findByIdAndUpdate(id, { archived: true }, { new: true });
    }

    return await this.findById(id);
  }

  static async archiveWithChildren(id) {
    // Archive the configuration
    await ConfigurationModel.findByIdAndUpdate(id, { archived: true }, { new: true });

    // Find and archive all children recursively
    const children = await ConfigurationModel.find({ parent_id: id, archived: { $ne: true } }, '_id');

    for (const child of children) {
      await this.archiveWithChildren(child._id);
    }
  }

  static async restore(id) {
    const config = await this.findById(id);
    if (!config) {
      throw new Error("Configuration not found");
    }

    await ConfigurationModel.findByIdAndUpdate(id, { archived: false }, { new: true });
    return await this.findById(id);
  }

  static async delete(id) {
    // Check if configuration has children and get their names
    const children = await ConfigurationModel.find({ parent_id: id }, 'name type');

    if (children.length > 0) {
      const childNames = children.map(child => `${child.name} (${child.type})`).join(", ");
      throw new Error(`Cannot delete configuration with children. Child configurations: ${childNames}`);
    }

    const config = await this.findById(id);
    await ConfigurationModel.findByIdAndDelete(id);

    return config;
  }

  static async findByCreatedBy(userId) {
    const configs = await ConfigurationModel.find({ created_by: userId })
      .populate('parent_id', 'name type')
      .sort({ type: 1, createdAt: -1 });

    return configs.map(config => {
      const result = config.toJSON();
      
      if (config.parent_id) {
        result.parent_name = config.parent_id.name;
        result.parent_type = config.parent_id.type;
      }

      return result;
    });
  }
}

module.exports = Configuration;
