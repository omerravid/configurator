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
          await this.addDatabase({
            name: 'Embedded MongoDB',
            connectionString: connectionString,
            isEmbedded: true,
            isActive: true
          });
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

  // Data copying methods will be added in the next step
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

    // Implementation will be added in the next step
    throw new Error('Data copying not yet implemented');
  }

  async migrateDatabase(sourceDbName, targetDbName) {
    // Implementation will be added in the next step
    throw new Error('Database migration not yet implemented');
  }
}

module.exports = new DatabaseManager();
