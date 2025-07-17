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
  }) {
    // Set status: USER configs default to DRAFT (unless explicitly set), others are COMMITTED
    const finalStatus =
      type === "USER" || type === "VERSION" ? status || "DRAFT" : "COMMITTED";
    const id = this.generateId();

    const result = await db.query(
      `INSERT INTO configurations (id, name, type, parent_id, data, created_by, description, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        type,
        parentId || null,
        JSON.stringify(data || {}),
        createdBy,
        description,
        finalStatus,
      ],
    );

    // If creating a COMPONENT, automatically create a root version
    if (type === "COMPONENT") {
      await this.create({
        name: `${name}_root`,
        type: "VERSION",
        parentId: id,
        data: data || {},
        createdBy,
        description: `Root version of ${name}`,
        status: "DRAFT",
      });
    }

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
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.name = ?`,
      [name],
    );

    const config = result.rows[0];
    if (config && config.data) {
      config.data = JSON.parse(config.data);
    }
    return config;
  }

  static async findAll() {
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
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

  static async findByParentId(parentId) {
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.parent_id = ?
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
        "SELECT id, name, type, parent_id, data, status FROM configurations WHERE id = ?",
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
       WHERE id = ? AND type = 'USER' AND status = 'DRAFT'`,
      [id],
    );

    return await this.findById(id);
  }

  static async delete(id) {
    // Check if configuration has children
    const childrenResult = await db.query(
      "SELECT COUNT(*) as child_count FROM configurations WHERE parent_id = ?",
      [id],
    );

    if (parseInt(childrenResult.rows[0].child_count) > 0) {
      throw new Error("Cannot delete configuration with children");
    }

    const config = await this.findById(id);
    await db.query("DELETE FROM configurations WHERE id = ?", [id]);

    return config;
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
