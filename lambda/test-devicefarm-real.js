// Test real Device Farm API integration
const deviceFarmDevices = require('./device-farm-devices');

// Test event for real Device Farm API call
const realDevicesGetEvent = {
  httpMethod: 'GET',
  queryStringParameters: {
    platform: 'android'
  }
};

async function testRealDeviceFarm() {
  console.log('🔗 Testing REAL Device Farm API Integration');
  console.log('=========================================\n');

  try {
    console.log('📱 Fetching real Android devices from AWS Device Farm...');
    
    // This will make actual API calls to Device Farm
    const result = await deviceFarmDevices.handler(realDevicesGetEvent);
    
    if (result.statusCode === 200) {
      const body = JSON.parse(result.body);
      console.log('✅ SUCCESS: Connected to Device Farm!');
      console.log('Platform:', body.platform);
      console.log('Total devices found:', body.deviceCount);
      
      if (body.devices && body.devices.length > 0) {
        console.log('\n📋 Sample devices:');
        body.devices.slice(0, 3).forEach((device, index) => {
          console.log(`${index + 1}. ${device.name} (${device.manufacturer})`);
          console.log(`   Model: ${device.model}, OS: ${device.os} ${device.osVersion}`);
          console.log(`   ARN: ${device.arn}`);
          console.log('');
        });
      }
      
      if (body.groupedDevices) {
        console.log('📊 Devices by manufacturer:');
        Object.keys(body.groupedDevices).forEach(manufacturer => {
          console.log(`- ${manufacturer}: ${body.groupedDevices[manufacturer].length} devices`);
        });
      }
      
    } else {
      console.log('❌ FAILED: Device Farm API call failed');
      console.log('Status:', result.statusCode);
      console.log('Error:', result.body);
    }
    
  } catch (error) {
    console.error('💥 ERROR: Failed to test Device Farm integration');
    console.error('Details:', error.message);
    
    if (error.message.includes('Unable to locate credentials')) {
      console.log('\n💡 TIP: Make sure AWS credentials are properly set');
    } else if (error.message.includes('not authorized')) {
      console.log('\n💡 TIP: Check if your AWS credentials have Device Farm permissions');
    }
  }
}

// Run the test
testRealDeviceFarm();