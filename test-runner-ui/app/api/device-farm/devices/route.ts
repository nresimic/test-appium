import { NextResponse } from 'next/server';
import { 
  DeviceFarmClient,
  ListDevicesCommand,
  CreateDevicePoolCommand,
  GetDevicePoolCommand,
  DeviceAvailability
} from '@aws-sdk/client-device-farm';

const getDeviceFarmClient = () => {
  const awsProfile = process.env.AWS_PROFILE;
  
  if (awsProfile) {
    process.env.AWS_PROFILE = awsProfile;
    return new DeviceFarmClient({
      region: process.env.AWS_REGION || 'us-west-2'
    });
  }
  
  return new DeviceFarmClient({
    region: process.env.AWS_REGION || 'us-west-2',
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN
    } : undefined
  });
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform'); // 'android' or 'ios'
  
  if (!platform || !['android', 'ios'].includes(platform)) {
    return NextResponse.json({ 
      error: 'Platform parameter required (android or ios)' 
    }, { status: 400 });
  }
  
  try {
    const client = getDeviceFarmClient();
    const projectArn = process.env.NEXT_PUBLIC_DEVICE_FARM_PROJECT_ARN || 
      'arn:aws:devicefarm:us-west-2:859998284317:project:9a2e2485-4bd8-4b1a-af28-254326345350';
    
    console.log(`Fetching ${platform} devices from Device Farm...`);
    
    // Get ALL devices for the platform (not just AVAILABLE)
    // AWS Device Farm paginates results, so we need to fetch all pages
    let allDevices: any[] = [];
    let nextToken: string | undefined;
    
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
    
    console.log(`Found ${devices.length} available ${platform} devices`);
    
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
    }, {} as Record<string, typeof formattedDevices>);
    
    return NextResponse.json({
      platform,
      deviceCount: devices.length,
      devices: formattedDevices,
      groupedDevices
    });
    
  } catch (error: any) {
    console.error('Failed to fetch Device Farm devices:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// Create a device pool for a specific device
export async function POST(request: Request) {
  try {
    const { deviceArn, platform, projectArn: customProjectArn } = await request.json();
    
    if (!deviceArn || !platform) {
      return NextResponse.json({ 
        error: 'deviceArn and platform are required' 
      }, { status: 400 });
    }
    
    const client = getDeviceFarmClient();
    const projectArn = customProjectArn || 
      process.env.NEXT_PUBLIC_DEVICE_FARM_PROJECT_ARN || 
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
    
    return NextResponse.json({
      devicePoolArn: response.devicePool.arn,
      name: devicePoolName,
      message: 'Device pool created successfully'
    });
    
  } catch (error: any) {
    console.error('Failed to create device pool:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}