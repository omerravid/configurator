const db = require("./database");
const bcrypt = require("bcryptjs");

class User {
  static async create({ username, password, role = "USER" }) {
    const passwordHash = await bcrypt.hash(password, 10);
    const id = this.generateId();

    await db.query(
      `INSERT INTO users (id, username, password_hash, role) 
       VALUES (?, ?, ?, ?)`,
      [id, username, passwordHash, role],
    );

    return await this.findById(id);
  }

  static generateId() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  static async findById(id) {
    const result = await db.query(
      "SELECT id, username, role, created_at, updated_at FROM users WHERE id = ?",
      [id],
    );

    return result.rows[0];
  }

  static async findByUsername(username) {
    const result = await db.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]);

    return result.rows[0];
  }

  static async authenticate(username, password) {
    const user = await this.findByUsername(username);
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // Return user without password hash
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async findAll() {
    const result = await db.query(
      "SELECT id, username, role, created_at, updated_at FROM users ORDER BY created_at DESC",
    );

    return result.rows;
  }

  static async updateRole(id, role) {
    await db.query(
      `UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [role, id],
    );

    return await this.findById(id);
  }

  static async delete(id) {
    const user = await this.findById(id);
    await db.query("DELETE FROM users WHERE id = ?", [id]);
    return user;
  }
}

module.exports = User;
