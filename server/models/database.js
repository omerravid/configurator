const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const bcrypt = require("bcryptjs");

class Database {
  constructor() {
    const dbPath = path.join(__dirname, "../config_manager.db");
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error opening database:", err);
      } else {
        console.log("Connected to SQLite database");
        this.init();
      }
    });
  }

  async init() {
    const initSQL = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('ADMIN', 'USER')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Configurations table
      CREATE TABLE IF NOT EXISTS configurations (
          id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
          name TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('PRODUCT', 'INSTANCE', 'USER', 'COMPONENT', 'VERSION')),
          parent_id TEXT REFERENCES configurations(id) ON DELETE CASCADE,
          data TEXT NOT NULL DEFAULT '{}',
          status TEXT NOT NULL DEFAULT 'COMMITTED' CHECK (status IN ('DRAFT', 'COMMITTED')),
          archived BOOLEAN NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT NOT NULL REFERENCES users(id),
          description TEXT
      );
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(initSQL, async (err) => {
        if (err) {
          console.error("Error initializing database:", err);
          reject(err);
        } else {
          console.log("Database tables created successfully");
          await this.migrateTypeConstraint();
          await this.migrateArchivedField();
          await this.cleanupRootVersions();
          await this.createDefaultData();
          resolve();
        }
      });
    });
  }

  async createDefaultData() {
    try {
      // Check if admin user exists
      const adminExists = await this.query(
        "SELECT id FROM users WHERE username = ?",
        ["admin"],
      );

      if (adminExists.rows.length === 0) {
        // Create admin user with proper bcrypt hash
        const passwordHash = await bcrypt.hash("admin123", 10);

        await this.query(
          "INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)",
          ["admin-id-123", "admin", passwordHash, "ADMIN"],
        );

        console.log("Created default admin user");

        // Create sample configurations
        await this.query(
          `INSERT OR IGNORE INTO configurations (id, name, type, parent_id, data, created_by, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            "prod-ecommerce-123",
            "prod_ecommerce",
            "PRODUCT",
            null,
            JSON.stringify({
              system: {
                logging: {
                  level: "INFO",
                  retention_days: 30,
                },
                api_keys: ["key1", "key2"],
                database: {
                  connection_pool_size: 10,
                  timeout: 5000,
                },
              },
              feature_flags: {
                new_ui: false,
                beta_feature: false,
                analytics: true,
              },
              business: {
                tax_rate: 0.08,
                shipping_cost: 9.99,
              },
            }),
            "admin-id-123",
            "Main ecommerce product configuration",
          ],
        );

        await this.query(
          `INSERT OR IGNORE INTO configurations (id, name, type, parent_id, data, created_by, description)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            "inst-staging-eu-123",
            "inst_staging_eu",
            "INSTANCE",
            "prod-ecommerce-123",
            JSON.stringify({
              system: {
                logging: {
                  level: "DEBUG",
                },
                database: {
                  connection_pool_size: 5,
                },
              },
              feature_flags: {
                new_ui: true,
                beta_feature: true,
              },
            }),
            "admin-id-123",
            "Staging environment for EU region",
          ],
        );

        await this.query(
          `INSERT OR IGNORE INTO configurations (id, name, type, parent_id, data, status, created_by, description)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            "user-dev-john-123",
            "user_dev_john_v1",
            "USER",
            "inst-staging-eu-123",
            JSON.stringify({
              system: {
                logging: {
                  retention_days: 7,
                },
              },
              business: {
                tax_rate: 0.0,
              },
            }),
            "DRAFT",
            "admin-id-123",
            "John developer personal configuration",
          ],
        );

        console.log("Created sample configurations");
      } else {
        console.log("Admin user already exists");
      }
    } catch (error) {
      console.error("Error creating default data:", error);
    }
  }

  async migrateTypeConstraint() {
    try {
      // Check if migration is needed by testing if COMPONENT type can be inserted
      const testResult = await this.query("PRAGMA table_info(configurations)");

      // Get current table schema to see if we need to migrate
      try {
        await this.query("INSERT INTO configurations (id, name, type, data, created_by, description) VALUES ('test-id', 'test', 'COMPONENT', '{}', 'test-user', 'test')", []);
        // If this succeeds, we already have the new schema
        await this.query("DELETE FROM configurations WHERE id = 'test-id'");
        console.log("Type constraint already updated");
        return;
      } catch (e) {
        if (e.code === 'SQLITE_CONSTRAINT') {
          console.log("Migrating type constraint to include COMPONENT and VERSION...");

          // Create new table with updated constraint
          await this.query(`
            CREATE TABLE configurations_new (
              id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
              name TEXT UNIQUE NOT NULL,
              type TEXT NOT NULL CHECK (type IN ('PRODUCT', 'INSTANCE', 'USER', 'COMPONENT', 'VERSION')),
              parent_id TEXT REFERENCES configurations_new(id) ON DELETE CASCADE,
              data TEXT NOT NULL DEFAULT '{}',
              status TEXT NOT NULL DEFAULT 'COMMITTED' CHECK (status IN ('DRAFT', 'COMMITTED')),
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              created_by TEXT NOT NULL REFERENCES users(id),
              description TEXT
            );
          `);

          // Copy data from old table
          await this.query(`
            INSERT INTO configurations_new
            SELECT * FROM configurations;
          `);

          // Drop old table and rename new one
          await this.query("DROP TABLE configurations;");
          await this.query("ALTER TABLE configurations_new RENAME TO configurations;");

          console.log("Type constraint migration completed successfully");
        } else {
          throw e;
        }
      }
    } catch (error) {
      console.error("Error during type constraint migration:", error);
      throw error;
    }
  }

  async migrateArchivedField() {
    try {
      // Check if archived column exists
      const tableInfo = await this.query("PRAGMA table_info(configurations)");
      const hasArchivedColumn = tableInfo.rows.some(column => column.name === 'archived');

      if (!hasArchivedColumn) {
        console.log("Adding archived field to configurations table...");
        await this.query("ALTER TABLE configurations ADD COLUMN archived BOOLEAN NOT NULL DEFAULT 0");
        console.log("Archived field migration completed successfully");
      } else {
        console.log("Archived field already exists");
      }
    } catch (error) {
      console.error("Error during archived field migration:", error);
      throw error;
    }
  }

  async cleanupRootVersions() {
    try {
      console.log("Cleaning up automatically created root versions...");

      // Find and delete root versions (versions whose names end with "_root")
      const rootVersionsResult = await this.query(`
        SELECT id, name FROM configurations
        WHERE type = 'VERSION' AND name LIKE '%_root'
      `);

      if (rootVersionsResult.rows && rootVersionsResult.rows.length > 0) {
        for (const rootVersion of rootVersionsResult.rows) {
          await this.query("DELETE FROM configurations WHERE id = ?", [rootVersion.id]);
          console.log(`Removed root version: ${rootVersion.name}`);
        }
        console.log(`Cleaned up ${rootVersionsResult.rows.length} root versions`);
      } else {
        console.log("No root versions to clean up");
      }
    } catch (error) {
      console.error("Error during root versions cleanup:", error);
    }
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (
        sql.toUpperCase().startsWith("SELECT") ||
        sql.toUpperCase().startsWith("WITH")
      ) {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({ rows });
          }
        });
      } else {
        this.db.run(sql, params, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve({
              rows: [{ id: this.lastID }],
              rowsAffected: this.changes,
            });
          }
        });
      }
    });
  }

  transaction(callback) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run("BEGIN TRANSACTION");

        try {
          const result = callback(this);
          this.db.run("COMMIT");
          resolve(result);
        } catch (error) {
          this.db.run("ROLLBACK");
          reject(error);
        }
      });
    });
  }

  close() {
    return new Promise((resolve) => {
      this.db.close((err) => {
        if (err) {
          console.error("Error closing database:", err);
        }
        resolve();
      });
    });
  }
}

module.exports = new Database();
