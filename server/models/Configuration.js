const db = require("./database");

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
    const id = this.generateId();

    const result = await db.query(
      `INSERT INTO configurations (id, name, type, parent_id, data, created_by, description, status, archived)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        type,
        parentId || null,
        JSON.stringify(data || {}),
        createdBy,
        description,
        finalStatus,
        archived ? 1 : 0,
      ],
    );

    // Components now act as their own root version
    // No need to create separate root versions

    return await this.findById(id);
  }

  static generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  static async findById(id) {
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.id = ?`,
      [id],
    );

    const config = result.rows[0];
    if (config && config.data) {
      config.data = JSON.parse(config.data);
    }
    return config;
  }

  static async findByName(name) {
    console.log(`[Configuration.findByName] Searching for name: "${name}" (length: ${name?.length}, has spaces: ${name?.includes(' ')})`);

    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.name = ?`,
      [name],
    );

    console.log(`[Configuration.findByName] Query returned ${result.rows.length} rows`);
    if (result.rows.length === 0) {
      // Debug: Show similar names to help identify the issue
      const allConfigsResult = await db.query(
        `SELECT name FROM configurations WHERE name LIKE ?`,
        [`%${name.split(' ')[0]}%`] // Search for partial match
      );
      console.log(`[Configuration.findByName] Similar names found:`, allConfigsResult.rows.map(r => `"${r.name}"`));
    }

    const config = result.rows[0];
    if (config) {
      console.log(`[Configuration.findByName] Found config: "${config.name}" (ID: ${config.id})`);
      if (config.data) {
        config.data = JSON.parse(config.data);
      }
    }
    return config;
  }

  static async findAll(includeArchived = false) {
    const archivedFilter = includeArchived ? '' : 'WHERE c.archived = 0';
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       ${archivedFilter}
       ORDER BY c.type, c.created_at DESC`,
    );

    return result.rows.map((config) => {
      if (config.data) {
        config.data = JSON.parse(config.data);
      }
      return config;
    });
  }

  static async findByType(type) {
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.type = ?
       ORDER BY c.created_at DESC`,
      [type],
    );

    return result.rows.map((config) => {
      if (config.data) {
        config.data = JSON.parse(config.data);
      }
      return config;
    });
  }

  static async findByParentId(parentId, includeArchived = false) {
    const archivedFilter = includeArchived ? '' : 'AND c.archived = 0';
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.parent_id = ? ${archivedFilter}
       ORDER BY c.type, c.created_at DESC`,
      [parentId],
    );

    return result.rows.map((config) => {
      if (config.data) {
        config.data = JSON.parse(config.data);
      }
      return config;
    });
  }

  static async getInheritanceChain(configId) {
    // Since SQLite doesn't support recursive CTEs easily, we'll do this iteratively
    const chain = [];
    let currentId = configId;

    while (currentId) {
      const result = await db.query(
        `SELECT c.id, c.name, c.type, c.parent_id, c.data, c.status,
                pc.name as parent_name, pc.type as parent_type
         FROM configurations c
         LEFT JOIN configurations pc ON c.parent_id = pc.id
         WHERE c.id = ?`,
        [currentId],
      );

      if (result.rows.length === 0) break;

      const config = result.rows[0];
      config.data = JSON.parse(config.data);
      chain.push(config);

      currentId = config.parent_id;
    }

    // Reverse to get root first
    return chain.reverse();
  }

  static async update(id, { data, description }) {
    const updateFields = [];
    const values = [];

    if (data !== undefined) {
      updateFields.push("data = ?");
      values.push(JSON.stringify(data));
    }

    if (description !== undefined) {
      updateFields.push("description = ?");
      values.push(description);
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    updateFields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    await db.query(
      `UPDATE configurations SET ${updateFields.join(", ")} WHERE id = ?`,
      values,
    );

    return await this.findById(id);
  }

  static async updateName(id, name) {
    await db.query(
      `UPDATE configurations 
       SET name = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name, id],
    );

    return await this.findById(id);
  }

  static async commit(id) {
    await db.query(
      `UPDATE configurations 
       SET status = 'COMMITTED', updated_at = CURRENT_TIMESTAMP
              WHERE id = ? AND (type = 'USER' OR type = 'VERSION') AND status = 'DRAFT'`,
      [id],
    );

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
      await db.query(
        "UPDATE configurations SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]
      );
    }

    return await this.findById(id);
  }

  static async archiveWithChildren(id) {
    // Archive the configuration
    await db.query(
      "UPDATE configurations SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );

    // Find and archive all children recursively
    const children = await db.query(
      "SELECT id FROM configurations WHERE parent_id = ? AND archived = 0",
      [id]
    );

    for (const child of children.rows) {
      await this.archiveWithChildren(child.id);
    }
  }

  static async restore(id) {
    const config = await this.findById(id);
    if (!config) {
      throw new Error("Configuration not found");
    }

    await db.query(
      "UPDATE configurations SET archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );

    return await this.findById(id);
  }

  static async delete(id) {
    // Check if configuration has children and get their names
    const childrenResult = await db.query(
      "SELECT name, type FROM configurations WHERE parent_id = ?",
      [id],
    );

    if (childrenResult.rows.length > 0) {
      const childNames = childrenResult.rows.map(child => `${child.name} (${child.type})`).join(", ");
      throw new Error(`Cannot delete configuration with children. Child configurations: ${childNames}`);
    }

    const config = await this.findById(id);
    await db.query("DELETE FROM configurations WHERE id = ?", [id]);

    return config;
  }

  static async deleteAll() {
    await db.query("DELETE FROM configurations");
    return true;
  }

  static async findByCreatedBy(userId) {
    const result = await db.query(
      `SELECT c.*, pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.created_by = ?
       ORDER BY c.type, c.created_at DESC`,
      [userId],
    );

    return result.rows.map((config) => {
      if (config.data) {
        config.data = JSON.parse(config.data);
      }
      return config;
    });
  }
}

module.exports = Configuration;
