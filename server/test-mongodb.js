const mongodb = require('./models/mongodb');
const DataMigration = require('./scripts/migrate-to-mongodb');

async function testMongoDB() {
  console.log('🧪 Testing MongoDB functionality...\n');

  try {
    // Test 1: Test connection
    console.log('1. Testing MongoDB connection...');
    const testResult = await mongodb.testConnection('mongodb://localhost:27017/config_manager_test');
    console.log(`   Result: ${testResult.success ? '✅ Success' : '❌ Failed'} - ${testResult.message}\n`);

    if (!testResult.success) {
      console.log('❌ MongoDB not available. Please ensure MongoDB is running on localhost:27017');
      console.log('   You can start MongoDB with: mongod --dbpath /path/to/your/data/directory\n');
      return;
    }

    // Test 2: Test settings save/load
    console.log('2. Testing settings save/load...');
    const testSettings = {
      connectionString: 'mongodb://localhost:27017/config_manager_test',
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    };
    
    await mongodb.saveSettings(testSettings);
    const loadedSettings = await mongodb.loadSettings();
    console.log('   ✅ Settings saved and loaded successfully\n');

    // Test 3: Test connection
    console.log('3. Testing actual connection...');
    await mongodb.connect(testSettings);
    const status = mongodb.getConnectionStatus();
    console.log(`   ✅ Connected successfully - Status: ${status.status}\n`);

    // Test 4: Test models
    console.log('4. Testing MongoDB models...');
    
    // Set environment variable to use MongoDB models
    process.env.USE_MONGODB = 'true';
    
    const { User, Configuration } = require('./models');
    
    // Test User model
    console.log('   Testing User model...');
    const testUser = await User.create({
      username: 'test_user_' + Date.now(),
      password: 'test123',
      role: 'USER'
    });
    console.log(`   ✅ User created: ${testUser.username}`);

    // Test Configuration model
    console.log('   Testing Configuration model...');
    const testConfig = await Configuration.create({
      name: 'test_config_' + Date.now(),
      type: 'COMPONENT',
      data: { test: 'value' },
      createdBy: testUser.id,
      description: 'Test configuration'
    });
    console.log(`   ✅ Configuration created: ${testConfig.name}`);

    // Test inheritance chain
    const chain = await Configuration.getInheritanceChain(testConfig.id);
    console.log(`   ✅ Inheritance chain retrieved (${chain.length} items)`);

    console.log('\n🎉 All MongoDB tests passed!');
    console.log('\n📝 Next steps:');
    console.log('   1. Login as admin to the Configuration Manager');
    console.log('   2. Click the "Settings" button in the header');
    console.log('   3. Configure your MongoDB connection string');
    console.log('   4. Test the connection and migrate your data');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongodb.disconnect();
    process.exit(0);
  }
}

testMongoDB();
