const { Configuration, User } = require('../models');

const sampleConfigurations = [
  {
    name: "Database Component",
    type: "COMPONENT", 
    data: {
      host: "localhost",
      port: 5432,
      database: "myapp",
      ssl: false,
      connectionTimeout: 30000,
      maxConnections: 10
    },
    description: "Standard database configuration component",
    created_by: "admin",
    status: "COMMITTED"
  },
  {
    name: "API Gateway Component", 
    type: "COMPONENT",
    data: {
      baseUrl: "https://api.example.com",
      timeout: 10000,
      retryAttempts: 3,
      authentication: {
        type: "bearer",
        tokenEndpoint: "/auth/token"
      },
      rateLimit: {
        requests: 1000,
        window: 3600
      }
    },
    description: "API Gateway configuration for external services",
    created_by: "admin", 
    status: "COMMITTED"
  },
  {
    name: "Cache Component",
    type: "COMPONENT",
    data: {
      type: "redis",
      host: "localhost", 
      port: 6379,
      ttl: 3600,
      maxMemory: "100mb",
      evictionPolicy: "allkeys-lru"
    },
    description: "Caching layer configuration",
    created_by: "admin",
    status: "COMMITTED"
  },
  {
    name: "MyApp Product",
    type: "PRODUCT",
    data: {
      database: {
        componentId: null, // Will be set after components are created
        versionId: null,
        componentName: "Database Component",
        versionName: "Database Component (root)"
      },
      api: {
        componentId: null, // Will be set after components are created  
        versionId: null,
        componentName: "API Gateway Component",
        versionName: "API Gateway Component (root)"
      },
      cache: {
        componentId: null, // Will be set after components are created
        versionId: null, 
        componentName: "Cache Component",
        versionName: "Cache Component (root)"
      },
      appConfig: {
        name: "My Application",
        version: "1.0.0",
        environment: "development"
      }
    },
    description: "Main application product configuration",
    created_by: "admin",
    status: "COMMITTED"
  }
];

async function initializeSampleData() {
  try {
    console.log('Checking if sample data already exists...');
    
    // Check if we already have configurations
    const existingConfigs = await Configuration.findAll();
    if (existingConfigs && existingConfigs.length > 0) {
      console.log('Sample data already exists, skipping initialization');
      return;
    }

    console.log('Initializing database with sample configurations...');
    
    // Find admin user
    const adminUser = await User.findByUsername('admin');
    if (!adminUser) {
      throw new Error('Admin user not found. Please ensure the admin user is created first.');
    }

    console.log('Found admin user:', adminUser.id);

    const createdConfigs = [];

    // Create components first
    for (let i = 0; i < 3; i++) {
      const config = sampleConfigurations[i];
      const created = await Configuration.create({
        ...config,
        created_by: adminUser.id
      });
      createdConfigs.push(created);
      console.log(`Created component: ${config.name}`);
    }

    // Update product configuration with component IDs
    const productConfig = sampleConfigurations[3];
    productConfig.data.database.componentId = createdConfigs[0].id;
    productConfig.data.database.versionId = createdConfigs[0].id;
    
    productConfig.data.api.componentId = createdConfigs[1].id; 
    productConfig.data.api.versionId = createdConfigs[1].id;
    
    productConfig.data.cache.componentId = createdConfigs[2].id;
    productConfig.data.cache.versionId = createdConfigs[2].id;

    // Create product
    const product = await Configuration.create({
      ...productConfig,
      created_by: adminUser.id
    });
    createdConfigs.push(product);
    console.log(`Created product: ${productConfig.name}`);

    // Create an instance of the product
    const instanceConfig = {
      name: "MyApp - Production",
      type: "INSTANCE",
      parent_id: product.id,
      data: {
        database: {
          host: "prod-db.example.com",
          ssl: true
        },
        api: {
          baseUrl: "https://api.prod.example.com"
        },
        appConfig: {
          environment: "production",
          debug: false
        }
      },
      description: "Production instance with overrides",
      created_by: adminUser.id,
      status: "COMMITTED"
    };

    const instance = await Configuration.create(instanceConfig);
    console.log(`Created instance: ${instanceConfig.name}`);

    // Create a version of the database component
    const dbVersionConfig = {
      name: "Database Component v2",
      type: "VERSION", 
      parent_id: createdConfigs[0].id,
      data: {
        ssl: true,
        connectionTimeout: 60000,
        maxConnections: 20
      },
      description: "Enhanced database configuration with SSL",
      created_by: adminUser.id,
      status: "DRAFT"
    };

    const dbVersion = await Configuration.create(dbVersionConfig);
    console.log(`Created version: ${dbVersionConfig.name}`);

    console.log('Sample data initialization completed successfully!');
    console.log(`Created ${createdConfigs.length + 2} configurations total`);
    
  } catch (error) {
    console.error('Failed to initialize sample data:', error);
    throw error;
  }
}

// Export for use in other scripts
module.exports = { initializeSampleData, sampleConfigurations };

// Run if called directly
if (require.main === module) {
  initializeSampleData()
    .then(() => {
      console.log('Sample data initialization script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sample data initialization failed:', error);
      process.exit(1);
    });
}
