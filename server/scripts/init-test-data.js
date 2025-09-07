const { Configuration, User } = require('../models');

// Test data for the secondary MongoDB instance
const testSampleData = [
  {
    name: "IoT Sensor Hub",
    type: "COMPONENT", 
    data: {
      connectivity: {
        wifi: {
          enabled: true,
          frequency: "2.4GHz",
          standards: ["802.11n", "802.11g"]
        },
        bluetooth: {
          enabled: true,
          version: "5.0",
          lowEnergy: true
        },
        cellular: {
          enabled: false,
          bands: ["LTE-M", "NB-IoT"]
        }
      },
      sensors: {
        temperature: {
          range: [-40, 125],
          accuracy: 0.1,
          unit: "celsius"
        },
        humidity: {
          range: [0, 100],
          accuracy: 2,
          unit: "percent"
        },
        pressure: {
          range: [300, 1100],
          accuracy: 0.1,
          unit: "hPa"
        }
      },
      power: {
        voltage: "3.3V",
        consumption: "15mA",
        sleepMode: "2µA"
      }
    },
    description: "IoT sensor hub for environmental monitoring",
    status: "COMMITTED"
  },
  {
    name: "Edge Gateway",
    type: "COMPONENT",
    data: {
      processor: {
        cpu: "ARM Cortex-A72",
        cores: 4,
        frequency: "1.5GHz",
        architecture: "64-bit"
      },
      memory: {
        ram: "4GB",
        storage: "32GB eMMC",
        expandable: "microSD up to 256GB"
      },
      connectivity: {
        ethernet: {
          ports: 2,
          speed: "1Gbps"
        },
        wifi: {
          standards: ["802.11ac", "802.11ax"],
          frequency: ["2.4GHz", "5GHz"]
        },
        cellular: {
          enabled: true,
          bands: ["4G LTE", "5G NSA"]
        }
      },
      protocols: {
        industrial: ["Modbus", "OPC-UA", "MQTT"],
        iot: ["CoAP", "LoRaWAN", "Zigbee"]
      }
    },
    description: "Industrial edge computing gateway",
    status: "COMMITTED"
  },
  {
    name: "Smart Factory Solution",
    type: "PRODUCT",
    data: {
      "IoT Sensor Hub": {
        componentId: null, // Will be set after components are created
        versionId: null,
        componentName: "IoT Sensor Hub",
        versionName: "IoT Sensor Hub (root)"
      },
      "Edge Gateway": {
        componentId: null, // Will be set after components are created
        versionId: null,
        componentName: "Edge Gateway", 
        versionName: "Edge Gateway (root)"
      }
    },
    description: "Complete smart factory monitoring solution",
    status: "COMMITTED"
  }
];

async function initializeTestData(force = false) {
  try {
    console.log('Initializing test database with sample data...');

    // Check if we already have configurations
    const existingConfigs = await Configuration.findAll();
    if (existingConfigs && existingConfigs.length > 0 && !force) {
      console.log('Test database already has data, skipping initialization');
      return;
    }

    // Clear existing data if force flag is set
    if (force && existingConfigs && existingConfigs.length > 0) {
      console.log('Force flag set - clearing existing configurations...');
      await Configuration.deleteAll();
      console.log('Existing configurations cleared');
    }

    // Find admin user
    const adminUser = await User.findByUsername('admin');
    if (!adminUser) {
      console.log('No admin user found in test database, creating one...');
      const newUser = await User.create({
        username: 'admin',
        password: 'admin123',
        role: 'ADMIN'
      });
      console.log('Admin user created in test database');
    }

    const admin = await User.findByUsername('admin');
    console.log('Found admin user:', admin.id);

    const createdComponents = [];
    let configCount = 0;

    // Create components and products
    for (const configData of testSampleData) {
      if (configData.type === 'COMPONENT') {
        const created = await Configuration.create({
          name: configData.name,
          type: configData.type,
          data: configData.data,
          description: configData.description,
          status: configData.status,
          createdBy: admin.username
        });
        createdComponents.push(created);
        configCount++;
        console.log(`Created component: ${configData.name}`);
      }
    }

    // Create product with component references
    for (const configData of testSampleData) {
      if (configData.type === 'PRODUCT') {
        // Update component references with actual IDs
        const productData = { ...configData };
        
        if (productData.data['IoT Sensor Hub']) {
          const sensorComponent = createdComponents.find(c => c.name === 'IoT Sensor Hub');
          if (sensorComponent) {
            productData.data['IoT Sensor Hub'].componentId = sensorComponent.id;
            productData.data['IoT Sensor Hub'].versionId = sensorComponent.id;
          }
        }
        
        if (productData.data['Edge Gateway']) {
          const gatewayComponent = createdComponents.find(c => c.name === 'Edge Gateway');
          if (gatewayComponent) {
            productData.data['Edge Gateway'].componentId = gatewayComponent.id;
            productData.data['Edge Gateway'].versionId = gatewayComponent.id;
          }
        }

        const created = await Configuration.create({
          name: productData.name,
          type: productData.type,
          data: productData.data,
          description: productData.description,
          status: productData.status,
          createdBy: admin.username
        });
        configCount++;
        console.log(`Created product: ${productData.name}`);
      }
    }

    console.log('Test data initialization completed successfully!');
    console.log(`Total configurations created: ${configCount}`);
    
  } catch (error) {
    console.error('Failed to initialize test data:', error);
    throw error;
  }
}

// Export for use in other scripts
module.exports = { initializeTestData, testSampleData };

// Run if called directly
if (require.main === module) {
  const force = process.env.FORCE_SAMPLE === 'true';
  initializeTestData(force)
    .then(() => {
      console.log('Test data initialization script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Test data initialization failed:', error);
      process.exit(1);
    });
}
