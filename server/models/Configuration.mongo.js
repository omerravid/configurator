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
    type: String,
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
    // Debug createdBy field
    console.log("🏗️  [Configuration.create] Debug createdBy:");
    console.log("🏗️  createdBy:", createdBy);
    console.log("🏗️  createdBy type:", typeof createdBy);
    console.log("🏗️  createdBy constructor:", createdBy?.constructor?.name);
    console.log("🏗️  createdBy JSON:", JSON.stringify(createdBy));

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

  // Helper function to fix populated fields by preserving original IDs
  static fixPopulatedFields(result) {
    if (!result) return result;

    // Handle single object
    if (!Array.isArray(result)) {
      // Preserve original IDs before they get overwritten by populated objects
      const originalParentId = result.parent_id ? result.parent_id._id || result.parent_id : null;
      const originalCreatedBy = result.created_by ? result.created_by._id || result.created_by : null;

      // Add populated fields in expected format
      if (result.created_by && typeof result.created_by === 'object') {
        result.created_by_username = result.created_by.username;
        result.created_by = originalCreatedBy; // Restore original ID string
      }
      if (result.parent_id && typeof result.parent_id === 'object') {
        result.parent_name = result.parent_id.name;
        result.parent_type = result.parent_id.type;
        result.parent_id = originalParentId; // Restore original ID string
      }

      return result;
    }

    // Handle array of objects
    return result.map(item => this.fixPopulatedFields(item.toJSON ? item.toJSON() : item));
  }

  static async findById(id) {
    console.log("=== Configuration.findById called ===");
    console.log("id received:", id);
    console.log("id type:", typeof id);
    console.log("id stringified:", JSON.stringify(id));

    // Convert ObjectId to string if needed
    let normalizedId = id;
    if (typeof id === 'object' && id !== null) {
      if (id.toString && typeof id.toString === 'function') {
        normalizedId = id.toString();
        console.log("Converted ObjectId to string:", normalizedId);
      } else {
        console.error("Received object that is not an ObjectId:", id);
        throw new Error(`Invalid ID format: ${JSON.stringify(id)}`);
      }
    }

    const config = await ConfigurationModel.findById(normalizedId)
      .populate('created_by', 'username')
      .populate('parent_id', 'name type');

    if (!config) return null;

    const result = config.toJSON();
    return this.fixPopulatedFields(result);

    return result;
  }

  static async findByName(name) {
    const config = await ConfigurationModel.findOne({ name })
      .populate('created_by', 'username')
      .populate('parent_id', 'name type');

    if (!config) return null;

    const result = config.toJSON();
    return this.fixPopulatedFields(result);
  }

  static async findAll(includeArchived = false) {
    const filter = includeArchived ? {} : { archived: { $ne: true } };
    const configs = await ConfigurationModel.find(filter)
      .populate('parent_id', 'name type')
      .sort({ type: 1, createdAt: -1 });

    // Get all unique user IDs to fetch usernames
    const userIds = [...new Set(configs.map(config => config.created_by))];
    const { User } = require('./index');
    const users = {};

    // Fetch all users at once
    for (const userId of userIds) {
      if (userId) {
        try {
          const user = await User.findById(userId);
          if (user) {
            users[userId] = user.username;
          }
        } catch (error) {
          console.warn(`Failed to fetch user ${userId}:`, error.message);
        }
      }
    }

    return configs.map(config => {
      // Extract populated data BEFORE calling toJSON()
      const parentName = config.parent_id?.name;
      const parentType = config.parent_id?.type;

      // Now call toJSON() which will convert ObjectIds to strings
      const result = config.toJSON();

      // Add username from our user lookup
      if (result.created_by && users[result.created_by]) {
        result.created_by_username = users[result.created_by];
      }

      // Add populated fields in expected format
      if (parentName) {
        result.parent_name = parentName;
      }
      if (parentType) {
        result.parent_type = parentType;
      }

      return result;
    });
  }

  static async findByType(type) {
    const configs = await ConfigurationModel.find({ type })
      .populate('parent_id', 'name type')
      .sort({ createdAt: -1 });

    // Get all unique user IDs to fetch usernames
    const userIds = [...new Set(configs.map(config => config.created_by))];
    const { User } = require('./index');
    const users = {};

    // Fetch all users at once
    for (const userId of userIds) {
      if (userId) {
        try {
          const user = await User.findById(userId);
          if (user) {
            users[userId] = user.username;
          }
        } catch (error) {
          console.warn(`Failed to fetch user ${userId}:`, error.message);
        }
      }
    }

    return configs.map(config => {
      // Extract populated data BEFORE calling toJSON()
      const parentName = config.parent_id?.name;
      const parentType = config.parent_id?.type;

      // Now call toJSON() which will convert ObjectIds to strings
      const result = config.toJSON();

      // Add username from our user lookup
      if (result.created_by && users[result.created_by]) {
        result.created_by_username = users[result.created_by];
      }

      // Add populated fields in expected format
      if (parentName) {
        result.parent_name = parentName;
      }
      if (parentType) {
        result.parent_type = parentType;
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
      // Extract populated data BEFORE calling toJSON()
      const createdByUsername = config.created_by?.username;

      // Now call toJSON() which will convert ObjectIds to strings
      const result = config.toJSON();

      // Add populated fields in expected format
      if (createdByUsername) {
        result.created_by_username = createdByUsername;
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

  // Helper method to deeply merge objects
  static deepMerge(target, source) {
    const result = JSON.parse(JSON.stringify(target)); // Deep clone target

    const merge = (obj, src) => {
      for (const key in src) {
        if (src.hasOwnProperty(key)) {
          // Handle deletion: if source value is null or undefined, delete the property
          if (src[key] === null || src[key] === undefined) {
            delete obj[key];
          } else if (src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
            if (!obj[key] || typeof obj[key] !== 'object') {
              obj[key] = {};
            }
            merge(obj[key], src[key]);
          } else {
            obj[key] = src[key];
          }
        }
      }
    };

    merge(result, source);
    return result;
  }

  static async update(id, { data, description }) {
    console.log("=== Configuration.update called ===");
    console.log("id received:", id);
    console.log("id type:", typeof id);
    console.log("id stringified:", JSON.stringify(id));

    // Ensure ID is a string for both MongoDB calls
    let normalizedId = id;
    if (typeof id === 'object' && id !== null) {
      if (id.toString && typeof id.toString === 'function') {
        normalizedId = id.toString();
        console.log("Converted ObjectId to string in update:", normalizedId);
      } else {
        console.error("Received object that is not an ObjectId in update:", id);
        throw new Error(`Invalid ID format in update: ${JSON.stringify(id)}`);
      }
    }

    const updateFields = {};

    if (data !== undefined) {
      // Get existing configuration to merge data instead of overriding
      const existingConfig = await ConfigurationModel.findById(normalizedId);
      if (!existingConfig) {
        throw new Error("Configuration not found for update");
      }

      // Merge incoming data with existing data
      const existingData = existingConfig.data || {};
      updateFields.data = this.deepMerge(existingData, data);

      console.log("Data merge - existing:", JSON.stringify(existingData, null, 2));
      console.log("Data merge - incoming:", JSON.stringify(data, null, 2));
      console.log("Data merge - result:", JSON.stringify(updateFields.data, null, 2));
    }

    if (description !== undefined) {
      updateFields.description = description;
    }

    if (Object.keys(updateFields).length === 0) {
      throw new Error("No fields to update");
    }

    await ConfigurationModel.findByIdAndUpdate(normalizedId, updateFields, { new: true });
    return await this.findById(normalizedId);
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
      // Extract populated data BEFORE calling toJSON()
      const parentName = config.parent_id?.name;
      const parentType = config.parent_id?.type;

      // Now call toJSON() which will convert ObjectIds to strings
      const result = config.toJSON();

      if (parentName) {
        result.parent_name = parentName;
      }
      if (parentType) {
        result.parent_type = parentType;
      }

      return result;
    });
  }
}

module.exports = Configuration;
