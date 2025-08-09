const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

class EmbeddedMongoDB {
  constructor() {
    this.mongod = null;
    this.connection = null;
    this.connectionString = null;
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
      
      console.log('Embedded MongoDB stopped');
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
      const { User } = require('./index');
      
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
