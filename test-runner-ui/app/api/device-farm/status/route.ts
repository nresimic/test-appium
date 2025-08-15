import { NextResponse } from 'next/server';
import { 
  DeviceFarmClient,
  GetRunCommand,
  ListJobsCommand
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
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN
    } : undefined
  });
};

// Load and save history functions
const getHistoryPath = () => {
  return path.join(process.cwd(), 'test-history.json');
};

async function loadHistory() {
  try {
    const data = await fs.readFile(getHistoryPath(), 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveHistory(history: any[]) {
  await fs.writeFile(getHistoryPath(), JSON.stringify(history, null, 2));
}

// GET endpoint to check Device Farm run status and update history
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runArn = searchParams.get('runArn');
  
  if (!runArn) {
    return NextResponse.json({ 
      error: 'Missing runArn parameter' 
    }, { status: 400 });
  }
  
  try {
    const client = getDeviceFarmClient();
    const command = new GetRunCommand({ arn: runArn });
    const { run } = await client.send(command);
    
    if (!run) {
      return NextResponse.json({ 
        error: 'Run not found' 
      }, { status: 404 });
    }
    
    // Update history if run is completed
    if (run.status === 'COMPLETED') {
      try {
        const history = await loadHistory();
        const runId = runArn.split('/').pop();
        const entryIndex = history.findIndex((entry: any) => 
          entry.id === runId || entry.runArn === runArn
        );
        
        if (entryIndex !== -1) {
          // Calculate duration
          let duration = 0;
          if (run.started && run.stopped) {
            duration = Math.round((new Date(run.stopped).getTime() - new Date(run.started).getTime()) / 1000);
          }
          
          // Update the entry
          history[entryIndex] = {
            ...history[entryIndex],
            status: 'COMPLETED',
            result: run.result || 'PASSED',
            duration,
            counters: run.counters ? {
              passed: run.counters.passed || 0,
              failed: run.counters.failed || 0,
              skipped: run.counters.skipped || 0,
              total: run.counters.total || 0
            } : undefined,
            hasAllureReport: true, // Device Farm tests generate Allure reports
            stopped: run.stopped
          };
          
          await saveHistory(history);
        }
      } catch (error) {
        console.error('Failed to update history:', error);
      }
    }
    
    return NextResponse.json({
      status: run.status,
      result: run.result,
      counters: run.counters,
      totalJobs: run.totalJobs,
      completedJobs: run.completedJobs,
      message: run.message,
      started: run.started,
      stopped: run.stopped,
      deviceMinutes: run.deviceMinutes
    });
  } catch (error: any) {
    console.error('Failed to get run status:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// POST endpoint to poll and update all running Device Farm tests
export async function POST() {
  try {
    const history = await loadHistory();
    const runningTests = history.filter((entry: any) => 
      entry.isDeviceFarm && entry.status !== 'COMPLETED' && entry.runArn
    );
    
    if (runningTests.length === 0) {
      return NextResponse.json({ 
        message: 'No running Device Farm tests to update',
        updated: 0
      });
    }
    
    const client = getDeviceFarmClient();
    let updatedCount = 0;
    
    for (const test of runningTests) {
      try {
        const command = new GetRunCommand({ arn: test.runArn });
        const { run } = await client.send(command);
        
        if (run) {
          const entryIndex = history.findIndex((entry: any) => entry.id === test.id);
          
          if (entryIndex !== -1) {
            let duration = 0;
            if (run.started && run.stopped) {
              duration = Math.round((new Date(run.stopped).getTime() - new Date(run.started).getTime()) / 1000);
            }
            
            // Update the entry with the latest status
            history[entryIndex] = {
              ...history[entryIndex],
              status: run.status || 'UNKNOWN',
              result: run.result || (run.status === 'COMPLETED' ? 'PASSED' : undefined),
              duration: run.status === 'COMPLETED' ? duration : undefined,
              counters: run.counters ? {
                passed: run.counters.passed || 0,
                failed: run.counters.failed || 0,
                skipped: run.counters.skipped || 0,
                total: run.counters.total || 0
              } : history[entryIndex].counters,
              hasAllureReport: run.status === 'COMPLETED',
              stopped: run.stopped
            };
            
            updatedCount++;
          }
        }
      } catch (error) {
        console.error(`Failed to update test ${test.id}:`, error);
      }
    }
    
    if (updatedCount > 0) {
      await saveHistory(history);
    }
    
    return NextResponse.json({ 
      message: `Updated ${updatedCount} Device Farm test(s)`,
      updated: updatedCount
    });
  } catch (error: any) {
    console.error('Failed to update Device Farm tests:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}