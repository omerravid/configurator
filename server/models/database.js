const { Pool } = require("pg");

class Database {
  constructor() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        "postgresql://postgres:password@localhost:5432/config_manager",
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    });
  }

  async query(text, params = []) {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  async transaction(callback) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = new Database();
