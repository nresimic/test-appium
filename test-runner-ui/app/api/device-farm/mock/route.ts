import { NextResponse } from 'next/server';

// Mock Device Farm API for testing without AWS credentials
export async function POST(request: Request) {
  try {
    const config = await request.json();
    
    // Simulate Device Farm test run
    const mockRunId = `mock-run-${Date.now()}`;
    
    console.log('[MOCK DEVICE FARM] Simulating test run:', {
      platform: config.platform,
      build: config.build,
      testMode: config.testMode
    });
    
    // Simulate async test execution
    setTimeout(() => {
      console.log(`[MOCK DEVICE FARM] Test ${mockRunId} started`);
      
      setTimeout(() => {
        console.log(`[MOCK DEVICE FARM] Test ${mockRunId} completed`);
        // In real scenario, this would update a database or storage
      }, 30000); // Simulate 30 second test
    }, 2000);
    
    return NextResponse.json({
      runId: mockRunId,
      status: 'SCHEDULING',
      message: 'Mock Device Farm test scheduled',
      mockMode: true,
      estimatedDuration: '30 seconds',
      devices: [
        { name: 'Samsung Galaxy S21', os: 'Android 13' },
        { name: 'Google Pixel 7', os: 'Android 13' }
      ]
    });
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// Get mock test status
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('runId');
  
  if (!runId) {
    // Return mock projects and device pools
    return NextResponse.json({
      projects: [
        {
          arn: 'arn:aws:devicefarm:us-west-2:mock:project:vault22-testing',
          name: 'Vault22 Testing (Mock)',
          created: new Date().toISOString()
        }
      ],
      devicePools: [
        {
          arn: 'arn:aws:devicefarm:us-west-2:mock:devicepool:android-phones',
          name: 'Android Phones',
          description: 'Popular Android devices',
          rules: [
            { attribute: 'PLATFORM', operator: 'EQUALS', value: 'ANDROID' }
          ]
        },
        {
          arn: 'arn:aws:devicefarm:us-west-2:mock:devicepool:ios-phones',
          name: 'iOS Phones', 
          description: 'Popular iOS devices',
          rules: [
            { attribute: 'PLATFORM', operator: 'EQUALS', value: 'IOS' }
          ]
        }
      ]
    });
  }
  
  // Simulate test progress
  const startTime = parseInt(runId.split('-').pop() || '0');
  const elapsed = Date.now() - startTime;
  
  let status = 'RUNNING';
  let result = null;
  let progress = Math.min(100, Math.floor((elapsed / 30000) * 100));
  
  if (elapsed > 30000) {
    status = 'COMPLETED';
    result = Math.random() > 0.3 ? 'PASSED' : 'FAILED';
    progress = 100;
  }
  
  return NextResponse.json({
    runId,
    status,
    result,
    progress,
    mockMode: true,
    counters: {
      passed: result === 'PASSED' ? 10 : 7,
      failed: result === 'FAILED' ? 3 : 0,
      warned: 1,
      errored: result === 'FAILED' ? 2 : 0,
      stopped: 0,
      skipped: 2,
      total: 15
    },
    devices: [
      {
        name: 'Samsung Galaxy S21',
        status: status === 'COMPLETED' ? 'PASSED' : 'RUNNING',
        minutes: Math.floor(elapsed / 60000)
      },
      {
        name: 'Google Pixel 7',
        status: status === 'COMPLETED' ? result : 'RUNNING',
        minutes: Math.floor(elapsed / 60000)
      }
    ],
    artifacts: status === 'COMPLETED' ? {
      logs: 'https://mock-device-farm/logs',
      screenshots: 'https://mock-device-farm/screenshots',
      video: 'https://mock-device-farm/video'
    } : null
  });
}