// Test script for Lambda functions
const deviceFarmRun = require('./device-farm-run');
const deviceFarmDevices = require('./device-farm-devices');
const testHistory = require('./test-history');

// Mock event for testing device-farm-devices GET
const mockDevicesGetEvent = {
  httpMethod: 'GET',
  queryStringParameters: {
    platform: 'android'
  }
};

// Mock event for testing test-history GET
const mockHistoryGetEvent = {
  httpMethod: 'GET',
  queryStringParameters: {}
};

// Mock event for testing CORS
const mockOptionsEvent = {
  httpMethod: 'OPTIONS'
};

async function testLambdaFunctions() {
  console.log('🧪 Testing Lambda Functions Locally');
  console.log('=====================================\n');

  try {
    // Test 1: CORS preflight
    console.log('1️⃣ Testing CORS preflight (OPTIONS)...');
    const corsResult = await deviceFarmDevices.handler(mockOptionsEvent);
    console.log('✅ CORS Response:', corsResult.statusCode === 200 ? 'PASS' : 'FAIL');
    console.log('Headers:', corsResult.headers);
    console.log('');

    // Test 2: Device listing
    console.log('2️⃣ Testing Device Farm devices listing...');
    const devicesResult = await deviceFarmDevices.handler(mockDevicesGetEvent);
    console.log('✅ Devices Response:', devicesResult.statusCode === 200 ? 'PASS' : 'FAIL');
    if (devicesResult.statusCode === 200) {
      const body = JSON.parse(devicesResult.body);
      console.log('Platform:', body.platform);
      console.log('Device Count:', body.deviceCount);
    } else {
      console.log('Error:', devicesResult.body);
    }
    console.log('');

    // Test 3: Test history
    console.log('3️⃣ Testing Test History...');
    const historyResult = await testHistory.handler(mockHistoryGetEvent);
    console.log('✅ History Response:', historyResult.statusCode === 200 ? 'PASS' : 'FAIL');
    if (historyResult.statusCode === 200) {
      const body = JSON.parse(historyResult.body);
      console.log('History entries:', body.history?.length || 0);
    } else {
      console.log('Error:', historyResult.body);
    }
    console.log('');

    // Test 4: Environment variables check
    console.log('4️⃣ Checking Environment Variables...');
    console.log('AWS_REGION:', process.env.AWS_REGION || 'NOT_SET');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT_SET');
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT_SET');
    console.log('DEVICE_FARM_PROJECT_ARN:', process.env.DEVICE_FARM_PROJECT_ARN ? 'SET' : 'NOT_SET');
    console.log('');

    console.log('🎉 Local Lambda testing completed!');
    console.log('📝 Note: Device Farm Run function needs actual files to test upload functionality');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testLambdaFunctions();
}

module.exports = { testLambdaFunctions };