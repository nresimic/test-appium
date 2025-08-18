import { NextResponse } from 'next/server';
import { 
  DeviceFarmClient,
  ListRunsCommand
} from '@aws-sdk/client-device-farm';
import { promises as fs } from 'fs';
import path from 'path';

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

// GET endpoint to sync all Device Farm tests with history
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
        message: 'No tests found in Device Farm',
        synced: 0
      });
    }
    
    // Load existing history
    const historyPath = path.join(process.cwd(), 'test-history.json');
    let history = [];
    try {
      const data = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(data);
    } catch {
      // File doesn't exist yet
    }
    
    let syncedCount = 0;
    let addedCount = 0;
    
    // Filter to only completed runs
    const completedRuns = runs.filter(run => run.status === 'COMPLETED');
    
    console.log(`Found ${runs.length} total runs, ${completedRuns.length} completed runs`);
    
    // Process each completed Device Farm run
    for (const run of completedRuns) {
      const runId = run.arn?.split('/').pop() || `df-${Date.now()}`;
      const existingIndex = history.findIndex((h: any) => 
        h.runArn === run.arn || h.id === runId
      );
      
      const duration = run.started && run.stopped
        ? Math.round((new Date(run.stopped).getTime() - new Date(run.started).getTime()) / 1000)
        : 0;
      
      const historyEntry = {
        id: runId,
        name: run.name?.includes('Test Run') 
          ? 'Device Farm Test' 
          : run.name || 'Device Farm Test',
        status: run.status || 'UNKNOWN',
        result: run.result,
        created: run.created?.toISOString() || new Date().toISOString(),
        duration: run.status === 'COMPLETED' ? duration : undefined,
        device: 'AWS Device Farm',
        platform: run.platform?.toLowerCase() === 'android_app' ? 'android' : 'ios',
        build: 'app.apk',
        runArn: run.arn,
        isDeviceFarm: true,
        counters: run.counters ? {
          passed: run.counters.passed || 0,
          failed: run.counters.failed || 0,
          skipped: run.counters.skipped || 0,
          total: run.counters.total || 0,
          broken: 0
        } : undefined,
        hasAllureReport: run.status === 'COMPLETED'
      };
      
      if (existingIndex >= 0) {
        // Update existing entry
        history[existingIndex] = {
          ...history[existingIndex],
          ...historyEntry,
          // Preserve some fields from the original entry
          name: history[existingIndex].name || historyEntry.name,
          test: history[existingIndex].test,
          testCase: history[existingIndex].testCase
        };
        syncedCount++;
      } else {
        // Add new entry at the beginning
        history.unshift(historyEntry);
        addedCount++;
      }
    }
    
    // Sort by created date (newest first)
    history.sort((a: any, b: any) => 
      new Date(b.created).getTime() - new Date(a.created).getTime()
    );
    
    // Limit history to 100 entries
    if (history.length > 100) {
      history = history.slice(0, 100);
    }
    
    // Save updated history
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));
    
    return NextResponse.json({ 
      message: `Synced ${syncedCount} and added ${addedCount} completed Device Farm tests`,
      synced: syncedCount,
      added: addedCount,
      total: completedRuns.length,
      totalRuns: runs.length
    });
    
  } catch (error: any) {
    console.error('Failed to sync Device Farm tests:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}