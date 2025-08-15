import { NextResponse } from 'next/server';
import { 
  DeviceFarmClient,
  ListRunsCommand,
  GetRunCommand
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
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      sessionToken: process.env.AWS_SESSION_TOKEN
    }
  });
};

export async function GET() {
  try {
    const projectArn = process.env.DEVICE_FARM_PROJECT_ARN;
    
    if (!projectArn) {
      return NextResponse.json({ 
        error: 'DEVICE_FARM_PROJECT_ARN not configured' 
      }, { status: 500 });
    }
    
    const client = getDeviceFarmClient();
    
    // List all runs in the project
    const listCommand = new ListRunsCommand({
      arn: projectArn
    });
    
    const { runs } = await client.send(listCommand);
    
    if (!runs || runs.length === 0) {
      return NextResponse.json({ 
        runningTests: [],
        message: 'No tests found in Device Farm'
      });
    }
    
    // Filter for running tests (not completed)
    const runningTests = runs.filter(run => 
      run.status !== 'COMPLETED'
    ).map(run => ({
      id: run.arn?.split('/').pop() || `df-${Date.now()}`,
      name: run.name || 'Device Farm Test',
      status: run.status || 'UNKNOWN',
      created: run.created?.toISOString() || new Date().toISOString(),
      device: 'AWS Device Farm',
      platform: run.platform?.toLowerCase() || 'android',
      build: 'app.apk',
      runArn: run.arn,
      isDeviceFarm: true,
      result: run.result,
      counters: run.counters ? {
        passed: run.counters.passed || 0,
        failed: run.counters.failed || 0,
        skipped: run.counters.skipped || 0,
        total: run.counters.total || 0
      } : undefined
    }));
    
    // If we have running tests, also save them to history
    if (runningTests.length > 0) {
      try {
        const historyPath = require('path').join(process.cwd(), 'test-history.json');
        const fs = require('fs').promises;
        
        // Load existing history
        let history = [];
        try {
          const data = await fs.readFile(historyPath, 'utf-8');
          history = JSON.parse(data);
        } catch {
          // File doesn't exist yet
        }
        
        // Update or add running tests to history
        for (const test of runningTests) {
          const existingIndex = history.findIndex((h: any) => h.runArn === test.runArn);
          if (existingIndex >= 0) {
            // Update existing entry
            history[existingIndex] = { ...history[existingIndex], ...test };
          } else {
            // Add new entry
            history.unshift(test);
          }
        }
        
        // Save updated history
        await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
      } catch (error) {
        console.error('Failed to update history:', error);
      }
    }
    
    return NextResponse.json({ 
      runningTests,
      message: `Found ${runningTests.length} running tests`
    });
    
  } catch (error: any) {
    console.error('Failed to fetch running Device Farm tests:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}