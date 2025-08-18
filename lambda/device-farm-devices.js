const { DeviceFarmClient, ListDevicesCommand, CreateDevicePoolCommand } = require('@aws-sdk/client-device-farm');
const { getCredentialsFromRole } = require('./aws-credentials-role');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

const getDeviceFarmClient = async () => {
  const credentials = await getCredentialsFromRole();
  return new DeviceFarmClient({
    region: 'us-west-2',
    credentials
  });
};

exports.handler = async (event) => {
  console.log('Device Farm Devices Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const client = await getDeviceFarmClient();
    
    if (event.httpMethod === 'GET') {
      // List devices - REAL IMPLEMENTATION
      const platform = event.queryStringParameters?.platform;
      
      if (!platform || !['android', 'ios'].includes(platform)) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Platform parameter required (android or ios)' })
        };
      }

      console.log(`Fetching ${platform} devices from Device Farm...`);
      
      // Get ALL devices for the platform (not just AVAILABLE)
      // AWS Device Farm paginates results, so we need to fetch all pages
      let allDevices = [];
      let nextToken;
      
      do {
        const command = new ListDevicesCommand({
          filters: [
            {
              attribute: 'PLATFORM',
              operator: 'EQUALS',
              values: [platform.toUpperCase()]
            }
            // Removed AVAILABILITY filter to get all devices
          ],
          nextToken
        });
        
        const response = await client.send(command);
        const devices = response.devices || [];
        allDevices = [...allDevices, ...devices];
        nextToken = response.nextToken;
        
        console.log(`Fetched batch: ${devices.length} devices, total so far: ${allDevices.length}`);
      } while (nextToken);
      
      const devices = allDevices;
      
      console.log(`Found ${devices.length} ${platform} devices`);
      
      // Log raw devices for debugging
      console.log('Raw Device Farm devices:', devices.map(d => ({
        arn: d.arn,
        name: d.name,
        manufacturer: d.manufacturer,
        model: d.model,
        os: d.os,
        osVersion: d.osVersion,
        availability: d.availability
      })));

      // Format devices for UI
      const formattedDevices = devices.map(device => ({
        id: device.arn || '',
        arn: device.arn || '', // Include ARN explicitly
        name: device.name || 'Unknown Device',
        model: device.model || '',
        os: device.os || '',
        osVersion: device.osVersion || '',
        formFactor: device.formFactor || '',
        manufacturer: device.manufacturer || '',
        resolution: device.resolution ? `${device.resolution.width}x${device.resolution.height}` : '',
        heapSize: device.heapSize || 0,
        memory: device.memory || 0,
        cpu: device.cpu ? `${device.cpu.type} ${device.cpu.architecture}` : '',
        availability: device.availability || 'UNKNOWN'
      }));
      
      // Group by manufacturer and model for better UX
      const groupedDevices = formattedDevices.reduce((acc, device) => {
        const key = device.manufacturer || 'Unknown';
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(device);
        return acc;
      }, {});

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          platform,
          deviceCount: devices.length,
          devices: formattedDevices,
          groupedDevices
        })
      };
      
    } else if (event.httpMethod === 'POST') {
      // Create device pool - REAL IMPLEMENTATION
      const body = JSON.parse(event.body || '{}');
      const { deviceArn, platform, projectArn: customProjectArn } = body;
      
      if (!deviceArn || !platform) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'deviceArn and platform are required' })
        };
      }

      const projectArn = customProjectArn || 
        process.env.DEVICE_FARM_PROJECT_ARN || 
        'arn:aws:devicefarm:us-west-2:859998284317:project:9a2e2485-4bd8-4b1a-af28-254326345350';

      console.log(`Creating device pool for device: ${deviceArn}`);
      
      // Create a device pool with just this device
      const devicePoolName = `Single-Device-${Date.now()}`;
      const command = new CreateDevicePoolCommand({
        projectArn,
        name: devicePoolName,
        description: `Device pool for single device testing`,
        rules: [
          {
            attribute: 'ARN',
            operator: 'IN',
            value: `["${deviceArn}"]`
          }
        ]
      });
      
      const response = await client.send(command);
      
      if (!response.devicePool?.arn) {
        throw new Error('Failed to create device pool');
      }
      
      console.log(`Created device pool: ${response.devicePool.arn}`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          devicePoolArn: response.devicePool.arn,
          name: devicePoolName,
          message: 'Device pool created successfully'
        })
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Device Farm devices error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};