const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');

class MongoDB {
  constructor() {
    this.connection = null;
    this.settingsPath = path.join(__dirname, '../mongodb-settings.json');
    this.defaultSettings = {
      connectionString: 'mongodb://localhost:27017/config_manager',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    };
  }

  async loadSettings() {
    try {
      const settingsData = await fs.readFile(this.settingsPath, 'utf8');
      return JSON.parse(settingsData);
    } catch (error) {
      // If settings file doesn't exist, use defaults
      console.log('MongoDB settings file not found, using defaults');
      return this.defaultSettings;
    }
  }

  async saveSettings(settings) {
    try {
      await fs.writeFile(this.settingsPath, JSON.stringify(settings, null, 2));
      console.log('MongoDB settings saved successfully');
    } catch (error) {
      console.error('Failed to save MongoDB settings:', error);
      throw error;
    }
  }

  async connect(customSettings = null) {
    try {
      const settings = customSettings || await this.loadSettings();
      
      if (this.connection && mongoose.connection.readyState === 1) {
        console.log('MongoDB already connected');
        return this.connection;
      }

      console.log('Connecting to MongoDB...');
      this.connection = await mongoose.connect(settings.connectionString, settings.options);
      
      console.log('MongoDB connected successfully');
      return this.connection;
    } catch (error) {
      console.error('MongoDB connection failed:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      console.log('MongoDB disconnected');
    }
  }

  async testConnection(connectionString, options = {}) {
    try {
      const testConnection = await mongoose.createConnection(connectionString, {
        ...this.defaultSettings.options,
        ...options,
        serverSelectionTimeoutMS: 5000 // 5 second timeout for testing
      });
      
      await testConnection.close();
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  getConnectionStatus() {
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
      name: mongoose.connection.name
    };
  }
}

module.exports = new MongoDB();
