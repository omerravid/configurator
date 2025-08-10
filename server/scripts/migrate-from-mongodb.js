const mongoose = require('mongoose');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class MongoToSQLiteMigration {
  constructor() {
    this.mongoConnection = null;
    this.sqliteDb = null;
    this.sqliteDbPath = path.join(__dirname, '../config_manager.db');
  }

  async initSQLite() {
    return new Promise((resolve, reject) => {
      this.sqliteDb = new sqlite3.Database(this.sqliteDbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for migration');
          resolve();
        }
      });
    });
  }

  async querySQLite(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.sqliteDb.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes, lastID: this.lastID });
        }
      });
    });
  }

  async connectToMongoDB(connectionString) {
    try {
      // Close existing connection if any
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }
      
      this.mongoConnection = await mongoose.connect(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      console.log('Connected to MongoDB for migration');
      return this.mongoConnection;
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async migrateUsers() {
    console.log('Migrating users from MongoDB to SQLite...');
    
    const UserModel = mongoose.model('User');
    const users = await UserModel.find({}).sort({ createdAt: 1 });
    
    // Clear existing users in SQLite
    await this.querySQLite('DELETE FROM users');
    
    for (const user of users) {
      try {
        await this.querySQLite(
          `INSERT INTO users (id, username, password_hash, role, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            user.id,
            user.username,
            user.password_hash,
            user.role,
            user.createdAt.toISOString(),
            user.updatedAt.toISOString()
          ]
        );
        
        console.log(`Migrated user: ${user.username}`);
      } catch (error) {
        console.error(`Failed to migrate user ${user.username}:`, error.message);
      }
    }

    console.log(`Migrated ${users.length} users from MongoDB to SQLite`);
  }

  async migrateConfigurations() {
    console.log('Migrating configurations from MongoDB to SQLite...');
    
    const ConfigurationModel = mongoose.model('Configuration');
    const configurations = await ConfigurationModel.find({}).sort({ createdAt: 1 });
    
    // Clear existing configurations in SQLite
    await this.querySQLite('DELETE FROM configurations');
    
    for (const config of configurations) {
      try {
        await this.querySQLite(
          `INSERT INTO configurations (id, name, type, parent_id, data, created_by, description, status, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            config.id,
            config.name,
            config.type,
            config.parent_id || null,
            JSON.stringify(config.data || {}),
            config.created_by,
            config.description || '',
            config.status || 'COMMITTED',
            config.createdAt.toISOString(),
            config.updatedAt.toISOString()
          ]
        );
        
        console.log(`Migrated configuration: ${config.name} (${config.type})`);
      } catch (error) {
        console.error(`Failed to migrate configuration ${config.name}:`, error.message);
      }
    }

    console.log(`Migrated ${configurations.length} configurations from MongoDB to SQLite`);
  }

  async closeSQLite() {
    return new Promise((resolve) => {
      if (this.sqliteDb) {
        this.sqliteDb.close((err) => {
          if (err) {
            console.error('Error closing SQLite database:', err);
          } else {
            console.log('SQLite database connection closed');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  async migrate(mongoConnectionString) {
    try {
      console.log('Starting migration from MongoDB to SQLite...');
      
      // Connect to MongoDB
      await this.connectToMongoDB(mongoConnectionString);
      
      // Initialize SQLite
      await this.initSQLite();
      
      // Migrate users first (configurations depend on users)
      await this.migrateUsers();
      
      // Migrate configurations
      await this.migrateConfigurations();
      
      console.log('Migration from MongoDB to SQLite completed successfully!');
      
      return {
        success: true,
        message: 'Migration from MongoDB to SQLite completed successfully',
        stats: {
          users: await mongoose.model('User').countDocuments(),
          configurations: await mongoose.model('Configuration').countDocuments()
        }
      };
      
    } catch (error) {
      console.error('Migration from MongoDB to SQLite failed:', error);
      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        error: error
      };
    } finally {
      await this.closeSQLite();
      await mongoose.disconnect();
    }
  }
}

module.exports = MongoToSQLiteMigration;

// Allow running as a script
if (require.main === module) {
  async function runMigration() {
    const connectionString = process.argv[2] || 'mongodb://localhost:27017/config_manager';
    
    const migration = new MongoToSQLiteMigration();
    const result = await migration.migrate(connectionString);
    
    if (result.success) {
      console.log('\n✅ Migration successful!');
      console.log(`Migrated ${result.stats.users} users and ${result.stats.configurations} configurations`);
    } else {
      console.error('\n❌ Migration failed!');
      console.error(result.message);
      process.exit(1);
    }
    
    process.exit(0);
  }
  
  runMigration().catch(console.error);
}
