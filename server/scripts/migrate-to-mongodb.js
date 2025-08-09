const path = require('path');
const mongoose = require('mongoose');

// Import SQLite database
const sqlite3 = require('sqlite3').verbose();
const sqliteDbPath = path.join(__dirname, '../config_manager.db');

// Import MongoDB models
const mongodb = require('../models/mongodb');
const UserMongo = require('../models/User.mongo');
const ConfigurationMongo = require('../models/Configuration.mongo');

class DataMigration {
  constructor() {
    this.sqliteDb = null;
    this.userIdMapping = new Map(); // SQLite ID -> MongoDB ID
  }

  async initSQLite() {
    return new Promise((resolve, reject) => {
      this.sqliteDb = new sqlite3.Database(sqliteDbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          resolve();
        }
      });
    });
  }

  async querySQLite(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.sqliteDb.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async migateUsers() {
    console.log('Migrating users...');
    
    const users = await this.querySQLite('SELECT * FROM users ORDER BY created_at');
    
    for (const user of users) {
      try {
        // Create user in MongoDB with the same password hash
        const mongoUser = new (mongoose.model('User'))({
          username: user.username,
          password_hash: user.password_hash,
          role: user.role,
          createdAt: new Date(user.created_at),
          updatedAt: new Date(user.updated_at)
        });

        const savedUser = await mongoUser.save();
        this.userIdMapping.set(user.id, savedUser._id.toString());
        
        console.log(`Migrated user: ${user.username}`);
      } catch (error) {
        console.error(`Failed to migrate user ${user.username}:`, error.message);
      }
    }

    console.log(`Migrated ${this.userIdMapping.size} users`);
  }

  async migrateConfigurations() {
    console.log('Migrating configurations...');
    
    // Get all configurations ordered by creation date to maintain dependencies
    const configurations = await this.querySQLite(
      'SELECT * FROM configurations ORDER BY created_at'
    );
    
    const configIdMapping = new Map(); // SQLite ID -> MongoDB ID
    
    for (const config of configurations) {
      try {
        // Parse JSON data
        let data = {};
        if (config.data) {
          try {
            data = JSON.parse(config.data);
          } catch (e) {
            console.warn(`Invalid JSON data for config ${config.name}, using empty object`);
          }
        }

        // Map parent_id from SQLite to MongoDB
        let parent_id = null;
        if (config.parent_id && configIdMapping.has(config.parent_id)) {
          parent_id = configIdMapping.get(config.parent_id);
        }

        // Map created_by from SQLite to MongoDB
        const created_by = this.userIdMapping.get(config.created_by);
        if (!created_by) {
          console.warn(`User not found for config ${config.name}, skipping`);
          continue;
        }

        // Create configuration in MongoDB
        const mongoConfig = new (mongoose.model('Configuration'))({
          name: config.name,
          type: config.type,
          parent_id: parent_id,
          data: data,
          created_by: created_by,
          description: config.description || '',
          status: config.status || 'COMMITTED',
          createdAt: new Date(config.created_at),
          updatedAt: new Date(config.updated_at)
        });

        const savedConfig = await mongoConfig.save();
        configIdMapping.set(config.id, savedConfig._id.toString());
        
        console.log(`Migrated configuration: ${config.name} (${config.type})`);
      } catch (error) {
        console.error(`Failed to migrate configuration ${config.name}:`, error.message);
      }
    }

    console.log(`Migrated ${configIdMapping.size} configurations`);
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

  async migrate(connectionString) {
    try {
      console.log('Starting migration from SQLite to MongoDB...');
      
      // Connect to MongoDB
      console.log('Connecting to MongoDB...');
      await mongodb.connect({ 
        connectionString, 
        options: { useNewUrlParser: true, useUnifiedTopology: true } 
      });
      
      // Initialize SQLite
      await this.initSQLite();
      
      // Clear existing MongoDB data (be careful!)
      console.log('Clearing existing MongoDB data...');

      // Create backup before clearing
      console.log('Creating backup of existing MongoDB data...');
      const existingUsers = await mongoose.model('User').find({});
      const existingConfigs = await mongoose.model('Configuration').find({});

      if (existingUsers.length > 0 || existingConfigs.length > 0) {
        const backupData = {
          timestamp: new Date().toISOString(),
          users: existingUsers,
          configurations: existingConfigs
        };

        const fs = require('fs').promises;
        const backupFile = `mongodb-backup-${Date.now()}.json`;
        await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));
        console.log(`Backup saved to: ${backupFile}`);
      }

      await mongoose.model('User').deleteMany({});
      await mongoose.model('Configuration').deleteMany({});
      
      // Migrate users first (configurations depend on users)
      await this.migateUsers();
      
      // Migrate configurations
      await this.migrateConfigurations();
      
      console.log('Migration completed successfully!');
      
      return {
        success: true,
        message: 'Migration completed successfully',
        stats: {
          users: this.userIdMapping.size,
          configurations: await mongoose.model('Configuration').countDocuments()
        }
      };
      
    } catch (error) {
      console.error('Migration failed:', error);
      return {
        success: false,
        message: `Migration failed: ${error.message}`,
        error: error
      };
    } finally {
      await this.closeSQLite();
    }
  }
}

// Export for use as a module
module.exports = DataMigration;

// Allow running as a script
if (require.main === module) {
  async function runMigration() {
    const connectionString = process.argv[2] || 'mongodb://localhost:27017/config_manager';
    
    const migration = new DataMigration();
    const result = await migration.migrate(connectionString);
    
    if (result.success) {
      console.log('\n✅ Migration successful!');
      console.log(`Migrated ${result.stats.users} users and ${result.stats.configurations} configurations`);
    } else {
      console.error('\n❌ Migration failed!');
      console.error(result.message);
      process.exit(1);
    }
    
    await mongodb.disconnect();
    process.exit(0);
  }
  
  runMigration().catch(console.error);
}
