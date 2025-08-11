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

      this.connection = await mongoose.connect(this.connectionString);

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
      const { User, Configuration } = require('./index');

      // Check if admin user exists
      const existingAdmin = await User.findByUsername('admin');
      let adminUser;

      if (!existingAdmin) {
        console.log('Creating default admin user...');
        adminUser = await User.create({
          username: 'admin',
          password: 'admin123', // Change this in production
          role: 'ADMIN'
        });
        console.log('Default admin user created (username: admin, password: admin123)');
      } else {
        console.log('Admin user already exists');
        adminUser = existingAdmin;
      }

      // Check if sample configurations exist
      const existingConfig = await Configuration.findByName('prod_ecommerce');
      if (!existingConfig) {
        console.log('Creating sample configurations...');

        // Create sample configurations similar to SQLite initialization
        const productConfig = await Configuration.create({
          name: 'prod_ecommerce',
          type: 'PRODUCT',
          parentId: null,
          data: {
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
          },
          createdBy: adminUser.id,
          description: 'Main ecommerce product configuration',
        });

        const instanceConfig = await Configuration.create({
          name: 'inst_staging_eu',
          type: 'INSTANCE',
          parentId: productConfig.id,
          data: {
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
          },
          createdBy: adminUser.id,
          description: 'Staging environment for EU region',
        });

        await Configuration.create({
          name: 'user_dev_john_v1',
          type: 'USER',
          parentId: instanceConfig.id,
          data: {
            system: {
              logging: {
                retention_days: 7,
              },
            },
            business: {
              tax_rate: 0.0,
            },
          },
          createdBy: adminUser.id,
          description: 'John developer personal configuration',
          status: 'DRAFT',
        });

        console.log('Sample configurations created');
      } else {
        console.log('Sample configurations already exist');
      }
    } catch (error) {
      console.error('Failed to initialize MongoDB data:', error);
    }
  }
}

module.exports = new EmbeddedMongoDB();
