const db = require("./database");

class Configuration {
  static async create({
    name,
    type,
    parentId,
    data,
    createdBy,
    description,
    status = "COMMITTED",
  }) {
    // For USER configs, default to DRAFT, otherwise COMMITTED
    const finalStatus = type === "USER" ? status || "DRAFT" : "COMMITTED";

    const result = await db.query(
      `INSERT INTO configurations (name, type, parent_id, data, created_by, description, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        name,
        type,
        parentId || null,
        JSON.stringify(data),
        createdBy,
        description,
        finalStatus,
      ],
    );

    return result.rows[0];
  }

  static async findById(id) {
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.id = $1`,
      [id],
    );

    return result.rows[0];
  }

  static async findByName(name) {
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.name = $1`,
      [name],
    );

    return result.rows[0];
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

    return result.rows;
  }

  static async findByType(type) {
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username,
              pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.type = $1
       ORDER BY c.created_at DESC`,
      [type],
    );

    return result.rows;
  }

  static async findByParentId(parentId) {
    const result = await db.query(
      `SELECT c.*, u.username as created_by_username
       FROM configurations c
       LEFT JOIN users u ON c.created_by = u.id
       WHERE c.parent_id = $1
       ORDER BY c.type, c.created_at DESC`,
      [parentId],
    );

    return result.rows;
  }

  static async getInheritanceChain(configId) {
    const result = await db.query(
      `WITH RECURSIVE inheritance_chain AS (
         -- Start with the target configuration
         SELECT id, name, type, parent_id, data, status, 0 as level
         FROM configurations 
         WHERE id = $1
         
         UNION ALL
         
         -- Recursively find parents
         SELECT c.id, c.name, c.type, c.parent_id, c.data, c.status, ic.level + 1
         FROM configurations c
         INNER JOIN inheritance_chain ic ON c.id = ic.parent_id
       )
       SELECT * FROM inheritance_chain 
       ORDER BY level DESC`,
      [configId],
    );

    return result.rows;
  }

  static async update(id, { data, description }) {
    const updateFields = [];
    const values = [];
    let paramCounter = 1;

    if (data !== undefined) {
      updateFields.push(`data = $${paramCounter++}`);
      values.push(JSON.stringify(data));
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCounter++}`);
      values.push(description);
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    values.push(id);

    const result = await db.query(
      `UPDATE configurations 
       SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCounter}
       RETURNING *`,
      values,
    );

    return result.rows[0];
  }

  static async commit(id) {
    const result = await db.query(
      `UPDATE configurations 
       SET status = 'COMMITTED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND type = 'USER' AND status = 'DRAFT'
       RETURNING *`,
      [id],
    );

    return result.rows[0];
  }

  static async delete(id) {
    // Check if configuration has children
    const childrenResult = await db.query(
      "SELECT COUNT(*) as child_count FROM configurations WHERE parent_id = $1",
      [id],
    );

    if (parseInt(childrenResult.rows[0].child_count) > 0) {
      throw new Error("Cannot delete configuration with children");
    }

    const result = await db.query(
      "DELETE FROM configurations WHERE id = $1 RETURNING *",
      [id],
    );

    return result.rows[0];
  }

  static async findByCreatedBy(userId) {
    const result = await db.query(
      `SELECT c.*, pc.name as parent_name, pc.type as parent_type
       FROM configurations c
       LEFT JOIN configurations pc ON c.parent_id = pc.id
       WHERE c.created_by = $1
       ORDER BY c.type, c.created_at DESC`,
      [userId],
    );

    return result.rows;
  }
}

module.exports = Configuration;
