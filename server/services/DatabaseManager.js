const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

class DatabaseManager {
  constructor() {
    this.connections = new Map(); // Map of connectionName -> mongoose connection
    this.databaseConfigs = new Map(); // Map of connectionName -> config object
    this.activeDatabase = null;
    this.configPath = path.join(__dirname, '../database-configs.json');
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await this.loadDatabaseConfigs();
      
      // Add embedded MongoDB as default if no configs exist
      if (this.databaseConfigs.size === 0) {
        const embeddedMongo = require('../models/embedded-mongodb');
        const connectionString = embeddedMongo.getConnectionString();

        if (connectionString) {
          console.log('Adding embedded MongoDB to database configs...');
          await this.addDatabase({
            name: 'Embedded MongoDB',
            connectionString: connectionString,
            description: 'Built-in embedded MongoDB server',
            isEmbedded: true,
            isActive: true
          });
          console.log('Embedded MongoDB added to database configs');
        } else {
          console.warn('Embedded MongoDB connection string not available');
        }
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize DatabaseManager:', error);
      throw error;
    }
  }

  async loadDatabaseConfigs() {
    try {
      const configData = await fs.readFile(this.configPath, 'utf8');
      const configs = JSON.parse(configData);
      
      this.databaseConfigs.clear();
      for (const config of configs) {
        this.databaseConfigs.set(config.name, config);
        if (config.isActive) {
          this.activeDatabase = config.name;
        }
      }
    } catch (error) {
      // File doesn't exist or is empty, start with empty configs
      console.log('No database configs file found, starting fresh');
      this.databaseConfigs.clear();
    }
  }

  async saveDatabaseConfigs() {
    try {
      const configs = Array.from(this.databaseConfigs.values());
      await fs.writeFile(this.configPath, JSON.stringify(configs, null, 2));
    } catch (error) {
      console.error('Failed to save database configs:', error);
      throw error;
    }
  }

  async addDatabase({ name, connectionString, description = '', isEmbedded = false }) {
    if (this.databaseConfigs.has(name)) {
      throw new Error(`Database with name "${name}" already exists`);
    }

    // Test connection before adding
    const testResult = await this.testConnection(connectionString);
    if (!testResult.success) {
      throw new Error(`Connection test failed: ${testResult.message}`);
    }

    const config = {
      name,
      connectionString,
      description,
      isEmbedded,
      isActive: this.databaseConfigs.size === 0, // First database becomes active
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.databaseConfigs.set(name, config);

    // If this is the first database or marked as active, set it as active
    if (config.isActive) {
      await this.setActiveDatabase(name);
    }

    await this.saveDatabaseConfigs();
    return config;
  }

  async updateDatabase(name, updates) {
    const config = this.databaseConfigs.get(name);
    if (!config) {
      throw new Error(`Database "${name}" not found`);
    }

    if (config.isEmbedded && (updates.connectionString || updates.name)) {
      throw new Error('Cannot modify connection string or name of embedded MongoDB');
    }

    // Test new connection string if provided
    if (updates.connectionString && updates.connectionString !== config.connectionString) {
      const testResult = await this.testConnection(updates.connectionString);
      if (!testResult.success) {
        throw new Error(`Connection test failed: ${testResult.message}`);
      }

      // Close existing connection if it exists
      await this.closeConnection(name);
    }

    const updatedConfig = {
      ...config,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Handle name change
    if (updates.name && updates.name !== name) {
      this.databaseConfigs.delete(name);
      this.databaseConfigs.set(updates.name, updatedConfig);
      
      // Update active database reference if needed
      if (this.activeDatabase === name) {
        this.activeDatabase = updates.name;
      }
    } else {
      this.databaseConfigs.set(name, updatedConfig);
    }

    await this.saveDatabaseConfigs();
    return updatedConfig;
  }

  async deleteDatabase(name) {
    const config = this.databaseConfigs.get(name);
    if (!config) {
      throw new Error(`Database "${name}" not found`);
    }

    if (config.isEmbedded) {
      throw new Error('Cannot delete embedded MongoDB configuration');
    }

    // Close connection if it exists
    await this.closeConnection(name);

    this.databaseConfigs.delete(name);

    // If this was the active database, set another as active
    if (this.activeDatabase === name) {
      const remainingDatabases = Array.from(this.databaseConfigs.keys());
      if (remainingDatabases.length > 0) {
        await this.setActiveDatabase(remainingDatabases[0]);
      } else {
        this.activeDatabase = null;
      }
    }

    await this.saveDatabaseConfigs();
    return config;
  }

  async setActiveDatabase(name) {
    const config = this.databaseConfigs.get(name);
    if (!config) {
      throw new Error(`Database "${name}" not found`);
    }

    // Update all configs to set isActive = false
    for (const [configName, configObj] of this.databaseConfigs) {
      configObj.isActive = configName === name;
    }

    this.activeDatabase = name;
    await this.saveDatabaseConfigs();

    // Connect to the new active database
    await this.connectToDatabase(name);
    
    return config;
  }

  async connectToDatabase(name) {
    const config = this.databaseConfigs.get(name);
    if (!config) {
      throw new Error(`Database "${name}" not found`);
    }

    // Close existing connection if different
    if (mongoose.connection.readyState === 1) {
      const currentDb = mongoose.connection.db?.databaseName;
      const newDbName = this.extractDatabaseName(config.connectionString);
      
      if (currentDb !== newDbName) {
        console.log('Switching database connections...');
        await mongoose.disconnect();
      }
    }

    try {
      const connection = await mongoose.connect(config.connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      console.log(`Connected to database: ${name}`);

      // Initialize default admin user if database is empty
      await this.initializeAdminUserIfNeeded();

      return connection;
    } catch (error) {
      console.error(`Failed to connect to database "${name}":`, error);
      throw error;
    }
  }

  async closeConnection(name) {
    if (this.connections.has(name)) {
      const connection = this.connections.get(name);
      await connection.close();
      this.connections.delete(name);
    }
  }

  async testConnection(connectionString) {
    try {
      const testConnection = await mongoose.createConnection(connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000 // 5 second timeout
      });
      
      await testConnection.close();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  getAllDatabases() {
    return Array.from(this.databaseConfigs.values());
  }

  getDatabase(name) {
    return this.databaseConfigs.get(name);
  }

  getActiveDatabase() {
    if (!this.activeDatabase) return null;
    return this.databaseConfigs.get(this.activeDatabase);
  }

  getActiveDatabaseName() {
    return this.activeDatabase;
  }

  extractDatabaseName(connectionString) {
    try {
      const url = new URL(connectionString);
      return url.pathname.substring(1); // Remove leading slash
    } catch (error) {
      // Fallback for malformed URLs
      const parts = connectionString.split('/');
      return parts[parts.length - 1] || 'config_manager';
    }
  }

  async getConnectionStatus() {
    const activeDb = this.getActiveDatabase();
    if (!activeDb) {
      return { status: 'no_active_database', databases: this.getAllDatabases() };
    }

    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };

    return {
      status: states[mongoose.connection.readyState] || 'unknown',
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      activeDatabase: activeDb.name,
      totalDatabases: this.databaseConfigs.size,
      databases: this.getAllDatabases()
    };
  }

  // Data copying methods
  async copyDataBetweenDatabases(sourceDbName, targetDbName, options = {}) {
    const {
      includeConfigurations = true,
      includeConfigurationTypes = [],
      adminOnly = true
    } = options;

    const sourceDb = this.databaseConfigs.get(sourceDbName);
    const targetDb = this.databaseConfigs.get(targetDbName);

    if (!sourceDb || !targetDb) {
      throw new Error('Source or target database not found');
    }

    if (sourceDbName === targetDbName) {
      throw new Error('Source and target databases cannot be the same');
    }

    console.log(`Starting data copy from "${sourceDbName}" to "${targetDbName}"`);

    const copyStats = {
      configurationsProcessed: 0,
      configurationsUpdated: 0,
      configurationsSkipped: 0,
      usersProcessed: 0,
      usersUpdated: 0,
      errors: []
    };

    try {
      // Step 1: Connect to source database
      await this.connectToDatabase(sourceDbName);
      const Configuration = require('../models/Configuration.mongo');

      // Step 2: Get admin users from source (always copy admin users to ensure authentication works)
      const adminUsers = await mongoose.model('User').find({ role: 'ADMIN' }).lean();
      console.log(`Found ${adminUsers.length} admin users to copy`);

      // Step 2a: Get admin-created configurations from source
      let configQuery = {};

      if (adminOnly) {
        const adminUsernames = adminUsers.map(user => user.username);

        if (adminUsernames.length === 0) {
          throw new Error('No admin users found in source database');
        }

        configQuery.created_by = { $in: adminUsernames };
      }

      // Filter by configuration types if specified
      if (includeConfigurationTypes.length > 0) {
        configQuery.type = { $in: includeConfigurationTypes };
      }

      const sourceConfigurations = await mongoose.model('Configuration').find(configQuery).lean();
      console.log(`Found ${sourceConfigurations.length} configurations to copy`);

      if (sourceConfigurations.length === 0) {
        return {
          success: true,
          message: 'No configurations found to copy',
          stats: copyStats
        };
      }

      // Step 3: Connect to target database
      await this.connectToDatabase(targetDbName);

      // Step 3a: Copy admin users to ensure authentication works in target database
      for (const adminUser of adminUsers) {
        try {
          copyStats.usersProcessed++;

          // Check if user already exists in target
          const existingUser = await mongoose.model('User').findOne({
            username: adminUser.username
          });

          if (existingUser) {
            // Update existing user to ensure it has admin role
            await mongoose.model('User').findByIdAndUpdate(existingUser._id, {
              role: 'ADMIN',
              password_hash: adminUser.password_hash // Keep the same password
            });
            copyStats.usersUpdated++;
            console.log(`Updated admin user: ${adminUser.username}`);
          } else {
            // Create new admin user
            const newUser = new (mongoose.model('User'))({
              username: adminUser.username,
              password_hash: adminUser.password_hash,
              role: 'ADMIN'
            });

            await newUser.save();
            copyStats.usersUpdated++;
            console.log(`Created admin user: ${adminUser.username}`);
          }
        } catch (userError) {
          console.error(`Error copying admin user ${adminUser.username}:`, userError);
          copyStats.errors.push({
            user: adminUser.username,
            error: userError.message
          });
        }
      }

      // Step 4: Process configurations
      for (const sourceConfig of sourceConfigurations) {
        try {
          copyStats.configurationsProcessed++;

          // Check if configuration already exists in target
          const existingConfig = await mongoose.model('Configuration').findOne({
            name: sourceConfig.name,
            type: sourceConfig.type
          });

          if (existingConfig) {
            // Update existing configuration (override but don't delete)
            await mongoose.model('Configuration').findByIdAndUpdate(existingConfig._id, {
              data: sourceConfig.data,
              description: sourceConfig.description,
              status: sourceConfig.status,
              archived: sourceConfig.archived,
              updatedAt: new Date()
            });

            copyStats.configurationsUpdated++;
            console.log(`Updated configuration: ${sourceConfig.name} (${sourceConfig.type})`);
          } else {
            // Create new configuration
            const newConfig = new (mongoose.model('Configuration'))({
              name: sourceConfig.name,
              type: sourceConfig.type,
              parent_id: sourceConfig.parent_id, // Note: parent relationships might break
              data: sourceConfig.data,
              created_by: sourceConfig.created_by,
              description: sourceConfig.description,
              status: sourceConfig.status,
              archived: sourceConfig.archived
            });

            await newConfig.save();
            copyStats.configurationsUpdated++;
            console.log(`Created configuration: ${sourceConfig.name} (${sourceConfig.type})`);
          }
        } catch (configError) {
          console.error(`Error processing configuration ${sourceConfig.name}:`, configError);
          copyStats.errors.push({
            configuration: sourceConfig.name,
            error: configError.message
          });
        }
      }

      console.log(`Data copy completed. Users: ${copyStats.usersUpdated}, Configurations: ${copyStats.configurationsUpdated}, Errors: ${copyStats.errors.length}`);

      return {
        success: true,
        message: `Successfully copied ${copyStats.usersUpdated} admin users and ${copyStats.configurationsUpdated} configurations`,
        stats: copyStats
      };

    } catch (error) {
      console.error('Data copy failed:', error);
      return {
        success: false,
        error: error.message,
        stats: copyStats
      };
    }
  }

  async migrateDatabase(sourceDbName, targetDbName) {
    const sourceDb = this.databaseConfigs.get(sourceDbName);
    const targetDb = this.databaseConfigs.get(targetDbName);

    if (!sourceDb || !targetDb) {
      throw new Error('Source or target database not found');
    }

    if (sourceDbName === targetDbName) {
      throw new Error('Source and target databases cannot be the same');
    }

    console.log(`Starting full migration from "${sourceDbName}" to "${targetDbName}"`);

    const migrationStats = {
      users: 0,
      configurations: 0,
      rules: 0,
      errors: []
    };

    try {
      // Step 1: Connect to source database and get all data
      await this.connectToDatabase(sourceDbName);

      const User = mongoose.model('User');
      const Configuration = mongoose.model('Configuration');

      const sourceUsers = await User.find({}).lean();
      const sourceConfigurations = await Configuration.find({}).lean();

      console.log(`Found ${sourceUsers.length} users and ${sourceConfigurations.length} configurations to migrate`);

      // Step 2: Connect to target database
      await this.connectToDatabase(targetDbName);

      // Step 3: Clear existing data in target database
      await mongoose.model('Configuration').deleteMany({});
      await mongoose.model('User').deleteMany({});

      console.log('Cleared target database');

      // Step 4: Migrate users
      for (const sourceUser of sourceUsers) {
        try {
          const newUser = new (mongoose.model('User'))({
            username: sourceUser.username,
            password_hash: sourceUser.password_hash,
            role: sourceUser.role
          });

          await newUser.save();
          migrationStats.users++;
        } catch (userError) {
          console.error(`Error migrating user ${sourceUser.username}:`, userError);
          migrationStats.errors.push({
            type: 'user',
            item: sourceUser.username,
            error: userError.message
          });
        }
      }

      // Step 5: Migrate configurations
      for (const sourceConfig of sourceConfigurations) {
        try {
          const newConfig = new (mongoose.model('Configuration'))({
            name: sourceConfig.name,
            type: sourceConfig.type,
            parent_id: sourceConfig.parent_id,
            data: sourceConfig.data,
            created_by: sourceConfig.created_by,
            description: sourceConfig.description,
            status: sourceConfig.status,
            archived: sourceConfig.archived
          });

          await newConfig.save();
          migrationStats.configurations++;
        } catch (configError) {
          console.error(`Error migrating configuration ${sourceConfig.name}:`, configError);
          migrationStats.errors.push({
            type: 'configuration',
            item: sourceConfig.name,
            error: configError.message
          });
        }
      }

      console.log(`Migration completed. Users: ${migrationStats.users}, Configurations: ${migrationStats.configurations}, Errors: ${migrationStats.errors.length}`);

      return {
        success: true,
        message: `Successfully migrated ${migrationStats.users} users and ${migrationStats.configurations} configurations`,
        stats: migrationStats
      };

    } catch (error) {
      console.error('Migration failed:', error);
      return {
        success: false,
        error: error.message,
        stats: migrationStats
      };
    }
  }

  // Initialize default admin user if database is empty
  async initializeAdminUserIfNeeded() {
    try {
      // Check if we're connected to MongoDB
      if (mongoose.connection.readyState !== 1) {
        return;
      }

      const User = mongoose.model('User');

      // Check if any users exist
      const userCount = await User.countDocuments();

      if (userCount === 0) {
        console.log('Database is empty, creating default admin user...');
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);

        await User.create({
          username: 'admin',
          password_hash: hashedPassword,
          role: 'ADMIN'
        });
        console.log('Default admin user created (username: admin, password: admin123)');
      } else {
        console.log(`Database already has ${userCount} users`);
      }
    } catch (error) {
      console.error('Failed to initialize admin user:', error);
    }
  }
}

module.exports = new DatabaseManager();
