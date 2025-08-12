const { Configuration, User } = require('../models');

// Three smart watch components with hierarchical structure
const sampleComponents = [
  {
    name: "Display",
    type: "COMPONENT", 
    data: {
      screen: {
        resolution: {
          width: 454,
          height: 454
        },
        brightness: {
          auto: true,
          min: 10,
          max: 100,
          default: 75
        },
        colorDepth: "16bit",
        refresh: 60
      },
      ui: {
        theme: "light",
        layout: "grid",
        animations: true,
        gestures: {
          swipe: true,
          tap: true,
          longPress: true,
          crown: true
        }
      },
      watchface: {
        style: "analog",
        complications: ["date", "battery", "steps"],
        customizable: true
      },
      alwaysOn: {
        enabled: false,
        dimLevel: 5,
        updateFreq: 1
      },
      accessibility: {
        fontSize: "medium",
        voiceOver: false,
        hapticFeedback: true
      }
    },
    description: "Complete display and user interface configuration for smart watch",
    status: "COMMITTED"
  },
  {
    name: "Sensors",
    type: "COMPONENT",
    data: {
      heartRate: {
        enabled: true,
        sampleRate: 1,
        accuracy: "high",
        zones: {
          resting: [50, 90],
          fat_burn: [90, 126],
          cardio: [126, 153],
          peak: [153, 200]
        }
      },
      gps: {
        enabled: true,
        accuracy: "balanced",
        satellites: ["GPS", "GLONASS"],
        assistedGPS: true,
        coldStart: 30,
        hotStart: 3
      },
      accelerometer: {
        enabled: true,
        sensitivity: "medium",
        range: "8g",
        sampleRate: 50
      },
      gyroscope: {
        enabled: true,
        range: "2000dps",
        calibration: true
      },
      barometer: {
        enabled: true,
        precision: 1,
        seaLevel: 1013.25
      },
      ambient: {
        light: true,
        temperature: false,
        humidity: false
      },
      stepCounter: {
        enabled: true,
        sensitivity: "auto",
        goalDaily: 10000
      }
    },
    description: "Comprehensive sensor package for health and fitness tracking",
    status: "COMMITTED"
  },
  {
    name: "Battery",
    type: "COMPONENT",
    data: {
      capacity: {
        mAh: 284,
        voltage: 3.8,
        chemistry: "LiPo"
      },
      charging: {
        method: "wireless",
        maxWatts: 5,
        fastCharge: false,
        efficiency: 85,
        timeToFull: 120
      },
      power: {
        management: "adaptive",
        lowPowerMode: {
          threshold: 20,
          features: ["gps", "wifi", "animations"],
          brightness: 30
        },
        sleepMode: {
          enabled: true,
          timeout: 300,
          wakeGestures: ["tap", "crown", "raise"]
        }
      },
      monitoring: {
        reporting: true,
        intervals: [1, 5, 15, 60],
        alerts: {
          low: 15,
          critical: 5
        },
        optimization: {
          adaptive: true,
          learning: true,
          backgroundSync: "smart"
        }
      },
      lifespan: {
        cycleCount: 0,
        degradation: 0,
        warranty: 500
      }
    },
    description: "Advanced battery management and power optimization system",
    status: "COMMITTED"
  }
];

// Component versions (one additional version per component)
const sampleVersions = [
  {
    name: "Display v2",
    type: "VERSION",
    parentComponent: "Display",
    data: {
      screen: {
        brightness: {
          max: 120,
          auto: true,
          outdoor: 90
        },
        colorDepth: "24bit",
        refresh: 120
      },
      ui: {
        theme: "adaptive",
        animations: true,
        gestures: {
          pinch: true,
          rotate: true
        }
      },
      alwaysOn: {
        enabled: true,
        dimLevel: 8,
        smartSchedule: true
      },
      accessibility: {
        fontSize: "large",
        voiceOver: true,
        magnification: 1.2
      }
    },
    description: "Enhanced display with higher refresh rate, adaptive themes, and improved accessibility",
    status: "COMMITTED"
  },
  {
    name: "Sensors v2",
    type: "VERSION", 
    parentComponent: "Sensors",
    data: {
      heartRate: {
        sampleRate: 0.5,
        accuracy: "clinical",
        zones: {
          resting: [45, 85],
          recovery: [85, 100],
          aerobic: [100, 140],
          anaerobic: [140, 175],
          neuromuscular: [175, 220]
        },
        variability: true
      },
      gps: {
        accuracy: "precise",
        satellites: ["GPS", "GLONASS", "Galileo", "BeiDou"],
        dualFreq: true,
        coldStart: 15,
        hotStart: 1
      },
      spo2: {
        enabled: true,
        accuracy: "medical",
        continuousMode: false,
        sleepTracking: true
      },
      temperature: {
        enabled: true,
        skin: true,
        ambient: true,
        fever: true
      }
    },
    description: "Advanced sensor suite with SpO2, temperature monitoring, and enhanced GPS",
    status: "COMMITTED"
  },
  {
    name: "Battery v2",
    type: "VERSION",
    parentComponent: "Battery", 
    data: {
      capacity: {
        mAh: 340,
        fastCharge: true
      },
      charging: {
        maxWatts: 7.5,
        timeToFull: 90,
        efficiency: 92,
        reverse: false
      },
      power: {
        management: "AI",
        lowPowerMode: {
          threshold: 30,
          aggressive: true
        },
        sleepMode: {
          deepSleep: true,
          scheduledWake: true
        }
      },
      monitoring: {
        intervals: [0.5, 1, 5, 15],
        health: {
          temperature: true,
          impedance: true,
          cycles: true
        },
        optimization: {
          usage: "predictive",
          appLearning: true
        }
      }
    },
    description: "Enhanced battery with larger capacity, fast charging, and AI-powered optimization",
    status: "COMMITTED"
  }
];

// Two smart watch products with different component combinations and no self data
const sampleProducts = [
  {
    name: "FitnessWatch Pro",
    type: "PRODUCT",
    data: {
      Display: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Display v2
        componentName: "Display",
        versionName: "Display v2"
      },
      Sensors: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Sensors v2
        componentName: "Sensors", 
        versionName: "Sensors v2"
      },
      Battery: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Battery v2
        componentName: "Battery",
        versionName: "Battery v2"
      }
    },
    description: "Premium fitness watch with advanced display, comprehensive sensors, and enhanced battery",
    status: "COMMITTED"
  },
  {
    name: "SmartWatch Lite",
    type: "PRODUCT", 
    data: {
      Display: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Display (root)
        componentName: "Display",
        versionName: "Display (root)"
      },
      Sensors: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Sensors (root)
        componentName: "Sensors",
        versionName: "Sensors (root)" 
      },
      Battery: {
        componentId: null, // Will be set after components are created
        versionId: null,   // Will use Battery (root)
        componentName: "Battery",
        versionName: "Battery (root)"
      }
    },
    description: "Essential smart watch with standard display, basic sensors, and standard battery",
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

    // 1. Create three smart watch components
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

    // 3. Create two smart watch products with different component combinations
    for (let i = 0; i < sampleProducts.length; i++) {
      const productData = sampleProducts[i];
      
      // Update component references with actual IDs
      if (productData.data.Display) {
        productData.data.Display.componentId = createdComponents[0].id; // Display component
        // Use Display v2 for FitnessWatch Pro, Display root for SmartWatch Lite
        productData.data.Display.versionId = i === 0 ? createdVersions[0].id : createdComponents[0].id;
      }
      
      if (productData.data.Sensors) {
        productData.data.Sensors.componentId = createdComponents[1].id; // Sensors component
        // Use Sensors v2 for FitnessWatch Pro, Sensors root for SmartWatch Lite
        productData.data.Sensors.versionId = i === 0 ? createdVersions[1].id : createdComponents[1].id;
      }
      
      if (productData.data.Battery) {
        productData.data.Battery.componentId = createdComponents[2].id; // Battery component
        // Use Battery v2 for FitnessWatch Pro, Battery root for SmartWatch Lite
        productData.data.Battery.versionId = i === 0 ? createdVersions[2].id : createdComponents[2].id;
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
        name: "FitnessWatch Pro - Sports Edition",
        type: "INSTANCE",
        parent_id: createdProducts[0].id,
        data: {
          Display: {
            screen: {
              brightness: {
                default: 85
              }
            },
            ui: {
              theme: "sport",
              layout: "tiles"
            },
            watchface: {
              style: "digital",
              complications: ["heartRate", "pace", "distance", "calories"]
            }
          },
          Sensors: {
            heartRate: {
              sampleRate: 0.2,
              zones: {
                sport: [120, 180]
              }
            },
            gps: {
              accuracy: "precise",
              recordingRate: 1
            }
          },
          Battery: {
            power: {
              management: "performance",
              lowPowerMode: {
                threshold: 25
              }
            }
          }
        },
        description: "Sports-optimized configuration for fitness enthusiasts",
        status: "COMMITTED"
      },
      {
        name: "SmartWatch Lite - Everyday Use",
        type: "INSTANCE", 
        parent_id: createdProducts[1].id,
        data: {
          Display: {
            screen: {
              brightness: {
                default: 60,
                auto: true
              }
            },
            ui: {
              theme: "classic",
              animations: false
            },
            alwaysOn: {
              enabled: false
            }
          },
          Sensors: {
            heartRate: {
              sampleRate: 5,
              accuracy: "balanced"
            },
            gps: {
              enabled: false
            },
            stepCounter: {
              goalDaily: 8000
            }
          },
          Battery: {
            power: {
              management: "efficiency",
              lowPowerMode: {
                threshold: 15,
                aggressive: true
              }
            }
          }
        },
        description: "Battery-optimized configuration for daily wear",
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
