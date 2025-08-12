const { Configuration, User } = require('../models');

// Three components with hierarchical structure
const sampleComponents = [
  {
    name: "Tools",
    type: "COMPONENT", 
    data: {
      TrailBlazer: {
        enabled: true,
        settings: {
          precision: "high",
          mode: "auto"
        }
      },
      ScrewInserter: {
        enabled: true,
        torque: 25,
        speed: "medium"
      },
      retractor: {
        enabled: false,
        position: "home"
      },
      OSDrill: {
        enabled: true,
        depth: 10.5,
        speed: "slow"
      },
      LidarCalib: {
        enabled: true,
        accuracy: 0.1,
        range: 100
      },
      HSdrill: {
        enabled: false,
        temperature: 25.0
      },
      fcu: {
        enabled: true,
        controlMode: "manual",
        timeout: 30
      },
      detectorDummy: {
        enabled: false,
        sensitivity: 0.8
      }
    },
    description: "Complete toolset configuration with 8 different tools",
    status: "COMMITTED"
  },
  {
    name: "IQ3",
    type: "COMPONENT",
    data: {
      system: {
        version: "3.1.4",
        mode: "production",
        debug: false
      },
      network: {
        interface: "eth0",
        dhcp: true,
        dns: ["8.8.8.8", "8.8.4.4"]
      },
      storage: {
        capacity: "1TB",
        compression: true,
        backup: {
          enabled: true,
          interval: "daily",
          retention: 30
        }
      },
      processing: {
        threads: 8,
        priority: "normal",
        cache: {
          size: "512MB",
          policy: "LRU"
        }
      },
      monitoring: {
        enabled: true,
        metrics: ["cpu", "memory", "disk", "network"],
        alerts: {
          cpu: 80,
          memory: 85,
          disk: 90
        }
      }
    },
    description: "IQ3 system configuration with comprehensive settings",
    status: "COMMITTED"
  },
  {
    name: "Database",
    type: "COMPONENT",
    data: {
      connection: {
        host: "localhost",
        port: 5432,
        database: "maindb",
        ssl: {
          enabled: false,
          verify: false
        }
      },
      pool: {
        min: 5,
        max: 20,
        timeout: 30000
      },
      queries: {
        timeout: 15000,
        retries: 3,
        cache: {
          enabled: true,
          ttl: 300
        }
      },
      logging: {
        enabled: true,
        level: "info",
        slowQuery: 5000
      },
      backup: {
        enabled: true,
        schedule: "0 2 * * *",
        retention: {
          daily: 7,
          weekly: 4,
          monthly: 12
        }
      }
    },
    description: "Database configuration with connection pooling and backup settings",
    status: "COMMITTED"
  }
];

// Component versions (one additional version per component)
const sampleVersions = [
  {
    name: "Tools v2",
    type: "VERSION",
    parentComponent: "Tools",
    data: {
      TrailBlazer: {
        settings: {
          precision: "ultra",
          mode: "precision"
        }
      },
      ScrewInserter: {
        torque: 35,
        speed: "fast"
      },
      HSdrill: {
        enabled: true,
        temperature: 22.0
      },
      detectorDummy: {
        enabled: true,
        sensitivity: 0.9
      }
    },
    description: "Enhanced tools configuration with improved precision and additional tool enablement",
    status: "COMMITTED"
  },
  {
    name: "IQ3 v2",
    type: "VERSION", 
    parentComponent: "IQ3",
    data: {
      system: {
        version: "3.2.1",
        mode: "performance"
      },
      processing: {
        threads: 16,
        priority: "high",
        cache: {
          size: "1GB",
          policy: "LFU"
        }
      },
      monitoring: {
        alerts: {
          cpu: 90,
          memory: 90,
          disk: 95
        }
      }
    },
    description: "Performance-optimized IQ3 version with enhanced processing capabilities",
    status: "COMMITTED"
  },
  {
    name: "Database v2",
    type: "VERSION",
    parentComponent: "Database", 
    data: {
      connection: {
        ssl: {
          enabled: true,
          verify: true
        }
      },
      pool: {
        max: 50,
        timeout: 60000
      },
      queries: {
        timeout: 30000,
        cache: {
          ttl: 600
        }
      },
      logging: {
        level: "debug",
        slowQuery: 2000
      }
    },
    description: "Enhanced database configuration with SSL and improved performance settings",
    status: "COMMITTED"
  }
];

// Two products with different component combinations and no self data
const sampleProducts = [
  {
    name: "Production System Alpha",
    type: "PRODUCT",
    data: {
      Tools: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Tools v2
        componentName: "Tools",
        versionName: "Tools v2"
      },
      IQ3: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use IQ3 (root)
        componentName: "IQ3", 
        versionName: "IQ3 (root)"
      },
      Database: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Database v2
        componentName: "Database",
        versionName: "Database v2"
      }
    },
    description: "Production system using enhanced tools, standard IQ3, and secure database",
    status: "COMMITTED"
  },
  {
    name: "Development System Beta",
    type: "PRODUCT", 
    data: {
      Tools: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Tools (root)
        componentName: "Tools",
        versionName: "Tools (root)"
      },
      IQ3: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use IQ3 v2
        componentName: "IQ3",
        versionName: "IQ3 v2" 
      }
      // Note: No Database component in this product
    },
    description: "Development system using standard tools and performance IQ3, no database",
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

    const createdComponents = [];
    const createdVersions = [];
    const createdProducts = [];
    const createdInstances = [];

    // 1. Create three components
    for (const componentData of sampleComponents) {
      const created = await Configuration.create({
        name: componentData.name,
        type: componentData.type,
        data: componentData.data,
        description: componentData.description,
        status: componentData.status,
        createdBy: adminUser.id
      });
      createdComponents.push(created);
      console.log(`Created component: ${componentData.name}`);
    }

    // 2. Create versions for each component
    for (let i = 0; i < sampleVersions.length; i++) {
      const versionData = sampleVersions[i];
      const parentComponent = createdComponents[i];
      
      const created = await Configuration.create({
        name: versionData.name,
        type: versionData.type,
        parentId: parentComponent.id,
        data: versionData.data,
        description: versionData.description,
        status: versionData.status,
        createdBy: adminUser.id
      });
      createdVersions.push(created);
      console.log(`Created version: ${versionData.name}`);
    }

    // 3. Create two products with different component combinations
    for (let i = 0; i < sampleProducts.length; i++) {
      const productData = sampleProducts[i];
      
      // Update component references with actual IDs
      if (productData.data.Tools) {
        productData.data.Tools.componentId = createdComponents[0].id; // Tools component
        // Use Tools v2 for first product, Tools root for second
        productData.data.Tools.versionId = i === 0 ? createdVersions[0].id : createdComponents[0].id;
      }
      
      if (productData.data.IQ3) {
        productData.data.IQ3.componentId = createdComponents[1].id; // IQ3 component
        // Use IQ3 root for first product, IQ3 v2 for second
        productData.data.IQ3.versionId = i === 0 ? createdComponents[1].id : createdVersions[1].id;
      }
      
      if (productData.data.Database) {
        productData.data.Database.componentId = createdComponents[2].id; // Database component
        productData.data.Database.versionId = createdVersions[2].id; // Database v2
      }

      const created = await Configuration.create({
        name: productData.name,
        type: productData.type,
        data: productData.data,
        description: productData.description,
        status: productData.status,
        createdBy: adminUser.id
      });
      createdProducts.push(created);
      console.log(`Created product: ${productData.name}`);
    }

    // 4. Create one instance per product
    const instanceConfigs = [
      {
        name: "Alpha Production Instance",
        type: "INSTANCE",
        parent_id: createdProducts[0].id,
        data: {
          Tools: {
            TrailBlazer: {
              settings: {
                mode: "production"
              }
            }
          },
          Database: {
            connection: {
              host: "prod-alpha-db.company.com",
              database: "alpha_prod"
            }
          }
        },
        description: "Production instance for Alpha system with environment-specific overrides",
        status: "COMMITTED"
      },
      {
        name: "Beta Development Instance",
        type: "INSTANCE", 
        parent_id: createdProducts[1].id,
        data: {
          Tools: {
            TrailBlazer: {
              enabled: true,
              settings: {
                mode: "debug",
                precision: "medium"
              }
            },
            ScrewInserter: {
              speed: "slow"
            }
          },
          IQ3: {
            system: {
              debug: true
            },
            monitoring: {
              alerts: {
                cpu: 95,
                memory: 95
              }
            }
          }
        },
        description: "Development instance for Beta system with debug settings",
        status: "COMMITTED"
      }
    ];

    for (const instanceData of instanceConfigs) {
      const created = await Configuration.create({
        name: instanceData.name,
        type: instanceData.type,
        parentId: instanceData.parent_id,
        data: instanceData.data,
        description: instanceData.description,
        status: instanceData.status,
        createdBy: adminUser.id
      });
      createdInstances.push(created);
      console.log(`Created instance: ${instanceData.name}`);
    }

    console.log('Sample data initialization completed successfully!');
    console.log(`Created ${createdComponents.length} components`);
    console.log(`Created ${createdVersions.length} versions`);
    console.log(`Created ${createdProducts.length} products`);
    console.log(`Created ${createdInstances.length} instances`);
    console.log(`Total configurations: ${createdComponents.length + createdVersions.length + createdProducts.length + createdInstances.length}`);
    
  } catch (error) {
    console.error('Failed to initialize sample data:', error);
    throw error;
  }
}

// Export for use in other scripts
module.exports = { initializeSampleData, sampleComponents, sampleVersions, sampleProducts };

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
