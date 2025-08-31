const { Configuration } = require('../models');
const { initializeSampleData } = require('./init-sample-data');

async function restoreSmartWatchData() {
  try {
    console.log('Starting smart watch data restoration...');
    
    // Get current count for backup info
    const existingConfigs = await Configuration.findAll();
    console.log(`Current configurations count: ${existingConfigs.length}`);
    
    if (existingConfigs.length > 0) {
      console.log('Clearing existing configurations...');
      
      // Delete all configurations
      await Configuration.deleteAll();
      console.log('All configurations cleared successfully');
    }
    
    // Initialize smart watch sample data
    console.log('Initializing smart watch sample data...');
    await initializeSampleData();
    
    console.log('Smart watch data restoration completed successfully!');
    
  } catch (error) {
    console.error('Failed to restore smart watch data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  restoreSmartWatchData()
    .then(() => {
      console.log('Smart watch restoration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Smart watch restoration failed:', error);
      process.exit(1);
    });
}

module.exports = { restoreSmartWatchData };
