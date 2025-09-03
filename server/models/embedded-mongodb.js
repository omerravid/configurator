const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

class EmbeddedMongoDB {
  constructor() {
    this.mongod = null;
    this.connection = null;
    this.connectionString = null;
    this.testMongod = null;
    this.testConnectionString = null;
  }

  async start() {
    try {
      console.log('Starting embedded MongoDB server...');
      
      // Create an in-memory MongoDB instance
      this.mongod = await MongoMemoryServer.create({
        instance: {
          dbName: 'config_manager',
          port: 27017, // Try to use standard port, will fallback if unavailable
        },
        binary: {
          version: '7.0.3' // Use Debian 12 compatible version
        }
      });

      this.connectionString = this.mongod.getUri();
      console.log(`Embedded MongoDB started at: ${this.connectionString}`);

      // Connect mongoose to the embedded instance
      // Close existing connection if any
      if (mongoose.connection.readyState !== 0) {
        console.log('Closing existing MongoDB connection...');
        await mongoose.disconnect();
      }

      this.connection = await mongoose.connect(this.connectionString, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      console.log('Connected to embedded MongoDB successfully');
      return this.connection;
    } catch (error) {
      console.error('Failed to start embedded MongoDB:', error);
      throw error;
    }
  }

  async startTestInstance() {
    try {
      console.log('Starting test MongoDB instance...');

      // Create a second in-memory MongoDB instance on a different port
      this.testMongod = await MongoMemoryServer.create({
        instance: {
          dbName: 'test_config_manager',
          port: 27018, // Different port for test instance
        },
        binary: {
          version: '7.0.3'
        }
      });

      this.testConnectionString = this.testMongod.getUri();
      console.log(`Test MongoDB started at: ${this.testConnectionString}`);

      return this.testConnectionString;
    } catch (error) {
      console.error('Failed to start test MongoDB:', error);
      throw error;
    }
  }

  async stop() {
    try {
      if (this.connection) {
        await mongoose.disconnect();
        this.connection = null;
      }

      if (this.mongod) {
        await this.mongod.stop();
        this.mongod = null;
      }

      if (this.testMongod) {
        await this.testMongod.stop();
        this.testMongod = null;
      }

      console.log('Embedded MongoDB instances stopped');
    } catch (error) {
      console.error('Error stopping embedded MongoDB:', error);
    }
  }

  getConnectionString() {
    return this.connectionString;
  }

  async getConnectionStatus() {
    if (!this.mongod) {
      return { status: 'stopped', uri: null };
    }

    const state = await this.mongod.getInstanceInfo();
    return {
      status: state ? 'running' : 'stopped',
      uri: this.connectionString,
      dbName: 'config_manager',
      type: 'embedded'
    };
  }

  // Initialize default admin user and seed data
  async initializeData() {
    try {
      console.log('Loading MongoDB models for user initialization...');
      const User = require('./User.mongo');

      // Check if admin user exists
      const existingAdmin = await User.findByUsername('admin');
      if (!existingAdmin) {
        console.log('Creating default admin user...');
        await User.create({
          username: 'admin',
          password: 'admin123', // Change this in production
          role: 'ADMIN'
        });
        console.log('Default admin user created (username: admin, password: admin123)');
      } else {
        console.log('Admin user already exists');
      }
    } catch (error) {
      console.error('Failed to initialize MongoDB data:', error);
    }
  }
}

module.exports = new EmbeddedMongoDB();
