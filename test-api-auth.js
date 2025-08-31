#!/usr/bin/env node

/**
 * Test script to verify third-party API authentication
 * This demonstrates how external services can access the system
 */

const baseUrl = 'http://localhost:3002';
const apiKey = 'sk-api-key-123456789abcdef';

async function testApiKeyAuthentication() {
  console.log('🧪 Testing Third-Party API Authentication\n');

  try {
    // Test 1: Get all configurations
    console.log('📋 Test 1: Fetching all configurations...');
    const configsResponse = await fetch(`${baseUrl}/api/configs`, {
      headers: {
        'X-API-Key': apiKey
      }
    });

    if (configsResponse.ok) {
      const configsData = await configsResponse.json();
      console.log(`✅ Success: Found ${configsData.configs.length} configurations`);
      
      // Test 2: Get specific configuration details
      if (configsData.configs.length > 0) {
        const firstConfig = configsData.configs[0];
        console.log(`\n📄 Test 2: Fetching configuration details for "${firstConfig.name}"...`);
        
        const configResponse = await fetch(`${baseUrl}/api/configs/${firstConfig.id}`, {
          headers: {
            'X-API-Key': apiKey
          }
        });

        if (configResponse.ok) {
          const configData = await configResponse.json();
          console.log(`✅ Success: Retrieved configuration data`);
          console.log(`   Type: ${configData.metadata?.configType || 'Unknown'}`);
          console.log(`   Data keys: ${Object.keys(configData.resolved || {}).join(', ')}`);
        } else {
          console.log(`❌ Failed: ${configResponse.status} ${configResponse.statusText}`);
        }
      }

    } else {
      console.log(`❌ Failed: ${configsResponse.status} ${configsResponse.statusText}`);
    }

    // Test 3: Test without API key (should fail)
    console.log(`\n🚫 Test 3: Testing without API key (should fail)...`);
    const noAuthResponse = await fetch(`${baseUrl}/api/configs`);
    
    if (noAuthResponse.status === 401) {
      console.log('✅ Success: Correctly rejected request without authentication');
    } else {
      console.log(`❌ Unexpected: ${noAuthResponse.status} ${noAuthResponse.statusText}`);
    }

    // Test 4: Test with invalid API key (should fail)
    console.log(`\n🔑 Test 4: Testing with invalid API key (should fail)...`);
    const invalidKeyResponse = await fetch(`${baseUrl}/api/configs`, {
      headers: {
        'X-API-Key': 'invalid-key'
      }
    });
    
    if (invalidKeyResponse.status === 401) {
      console.log('✅ Success: Correctly rejected request with invalid API key');
    } else {
      console.log(`❌ Unexpected: ${invalidKeyResponse.status} ${invalidKeyResponse.statusText}`);
    }

    // Test 5: Test file endpoint (if any files exist)
    console.log(`\n📁 Test 5: Testing file access...`);
    // For this test, we'll just verify the endpoint responds correctly to authentication
    // even if there are no files
    const fileTestResponse = await fetch(`${baseUrl}/api/files/non-existent-file`, {
      headers: {
        'X-API-Key': apiKey
      }
    });
    
    if (fileTestResponse.status === 404) {
      console.log('✅ Success: File endpoint authenticated correctly (file not found as expected)');
    } else if (fileTestResponse.status === 401) {
      console.log('❌ Failed: File endpoint rejected valid API key');
    } else {
      console.log(`ℹ️  Info: File endpoint returned ${fileTestResponse.status}`);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }

  console.log('\n🏁 API Authentication testing completed!');
  console.log('\n📖 See API_AUTHENTICATION.md for complete documentation');
}

// Run the test
if (require.main === module) {
  testApiKeyAuthentication();
}

module.exports = { testApiKeyAuthentication };
