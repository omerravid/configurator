const db = require("./database");
const bcrypt = require("bcryptjs");

class User {
  static async create({ username, password, role = "USER" }) {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (username, password_hash, role) 
       VALUES ($1, $2, $3) 
       RETURNING id, username, role, created_at, updated_at`,
      [username, passwordHash, role],
    );

    return result.rows[0];
  }

  static async findById(id) {
    const result = await db.query(
      "SELECT id, username, role, created_at, updated_at FROM users WHERE id = $1",
      [id],
    );

    return result.rows[0];
  }

  static async findByUsername(username) {
    const result = await db.query("SELECT * FROM users WHERE username = $1", [
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
    const result = await db.query(
      `UPDATE users SET role = $1 
       WHERE id = $2 
       RETURNING id, username, role, created_at, updated_at`,
      [role, id],
    );

    return result.rows[0];
  }

  static async delete(id) {
    const result = await db.query(
      "DELETE FROM users WHERE id = $1 RETURNING id",
      [id],
    );

    return result.rows[0];
  }
}

module.exports = User;
