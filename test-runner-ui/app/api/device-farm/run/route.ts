import { NextResponse } from 'next/server';
import { 
  DeviceFarmClient,
  CreateUploadCommand,
  GetUploadCommand,
  ScheduleRunCommand,
  GetRunCommand,
  ListUploadsCommand,
  UploadType,
  TestType,
  DevicePoolType
} from '@aws-sdk/client-device-farm';
import { CodeBuildClient, StartBuildCommand } from '@aws-sdk/client-codebuild';
import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import crypto from 'crypto';

const getDeviceFarmClient = () => {
  // Check if we should use a specific AWS profile
  const awsProfile = process.env.AWS_PROFILE;
  
  if (awsProfile) {
    // Use AWS profile from ~/.aws/credentials
    process.env.AWS_PROFILE = awsProfile;
    return new DeviceFarmClient({
      region: process.env.AWS_REGION || 'us-west-2'
      // SDK will automatically load credentials from the profile
    });
  }
  
  // Fallback to explicit credentials if provided
  return new DeviceFarmClient({
    region: process.env.AWS_REGION || 'us-west-2',
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN
    } : undefined
  });
};

// Generate file hash for caching
async function getFileHash(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256');
  hash.update(fileBuffer);
  return hash.digest('hex');
}

// Check if file is already uploaded
async function findExistingUpload(client: DeviceFarmClient, projectArn: string, fileName: string, fileHash: string, uploadType: UploadType): Promise<string | null> {
  try {
    console.log(`Checking for existing upload: ${fileName}`);
    
    const command = new ListUploadsCommand({
      arn: projectArn,
      type: uploadType
    });
    
    const response = await client.send(command);
    const uploads = response.uploads || [];
    
    // Look for matching upload by name and check if it's still valid (completed successfully)
    const matchingUpload = uploads.find(upload => 
      upload.name === fileName && 
      upload.status === 'SUCCEEDED' &&
      (upload.metadata as any)?.hash === fileHash // We'll store hash in metadata
    );
    
    if (matchingUpload?.arn) {
      console.log(`✅ Found existing upload: ${matchingUpload.arn}`);
      return matchingUpload.arn;
    }
    
    // Also check for recent uploads with same name (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentUpload = uploads.find(upload =>
      upload.name === fileName &&
      upload.status === 'SUCCEEDED' &&
      upload.created && new Date(upload.created) > oneDayAgo
    );
    
    if (recentUpload?.arn) {
      console.log(`✅ Found recent upload (assuming same file): ${recentUpload.arn}`);
      return recentUpload.arn;
    }
    
    console.log(`❌ No existing upload found for ${fileName}`);
    return null;
    
  } catch (error) {
    console.log('Error checking existing uploads:', error);
    return null; // If check fails, proceed with upload
  }
}

// Upload without caching (force fresh upload)
async function uploadToDeviceFarmNoCache(client: DeviceFarmClient, projectArn: string, filePath: string, uploadType: UploadType) {
  try {
    const fileName = path.basename(filePath);
    console.log(`🔄 Force uploading (no cache): ${fileName}`);
    
    // Create upload
    const createUploadCommand = new CreateUploadCommand({
      projectArn,
      name: fileName,
      type: uploadType
    });
    
    const { upload } = await client.send(createUploadCommand);
    if (!upload?.url || !upload?.arn) {
      throw new Error('Failed to create upload');
    }
    
    console.log(`Upload created, uploading to S3: ${upload.arn}`);
    
    // Check file exists and get size
    const fileStats = await fs.stat(filePath);
    console.log(`File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Upload file to S3
    const fileBuffer = await fs.readFile(filePath);
    console.log(`File loaded, uploading...`);
    
    const uploadResponse = await fetch(upload.url, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    console.log('File uploaded to S3, waiting for processing...');
    
    // Wait for upload to complete
    let uploadStatus = 'INITIALIZED';
    let attempts = 0;
    const maxAttempts = 30; // 1 minute timeout
    
    while ((uploadStatus === 'INITIALIZED' || uploadStatus === 'PROCESSING') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const getUploadCommand = new GetUploadCommand({ arn: upload.arn });
      const { upload: currentUpload } = await client.send(getUploadCommand);
      uploadStatus = currentUpload?.status || 'FAILED';
      console.log(`Upload status check ${attempts}/${maxAttempts}: ${uploadStatus}`);
    }
    
    if (uploadStatus !== 'SUCCEEDED') {
      throw new Error(`Upload failed with status: ${uploadStatus} after ${attempts} attempts`);
    }
    
    console.log('Upload completed successfully!');
    return upload.arn;
    
  } catch (error) {
    console.error('Error in uploadToDeviceFarmNoCache:', error);
    throw error;
  }
}

async function uploadToDeviceFarm(client: DeviceFarmClient, projectArn: string, filePath: string, uploadType: UploadType) {
  try {
    const fileName = path.basename(filePath);
    console.log(`Processing upload for: ${fileName}`);
    
    // Check for existing upload first
    const fileHash = await getFileHash(filePath);
    const existingUpload = await findExistingUpload(client, projectArn, fileName, fileHash, uploadType);
    
    if (existingUpload) {
      console.log(`🚀 Skipping upload - using existing file`);
      return existingUpload;
    }
    
    console.log(`📤 No existing upload found, creating new upload...`);
    
    // Create upload
    const createUploadCommand = new CreateUploadCommand({
      projectArn,
      name: fileName,
      type: uploadType
    });
    
    const { upload } = await client.send(createUploadCommand);
    if (!upload?.url || !upload?.arn) {
      throw new Error('Failed to create upload');
    }
    
    console.log(`Upload created, uploading to S3: ${upload.arn}`);
    
    // Check file exists and get size
    const fileStats = await fs.stat(filePath);
    console.log(`File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
    
    // Upload file to S3
    const fileBuffer = await fs.readFile(filePath);
    console.log(`File loaded, uploading...`);
    
    const uploadResponse = await fetch(upload.url, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
    
    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload file: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
    
    console.log('File uploaded to S3, waiting for processing...');
    
    // Wait for upload to complete
    let uploadStatus = 'INITIALIZED';
    let attempts = 0;
    const maxAttempts = 30; // 1 minute timeout
    
    while ((uploadStatus === 'INITIALIZED' || uploadStatus === 'PROCESSING') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
      
      const getUploadCommand = new GetUploadCommand({ arn: upload.arn });
      const { upload: currentUpload } = await client.send(getUploadCommand);
      uploadStatus = currentUpload?.status || 'FAILED';
      console.log(`Upload status check ${attempts}/${maxAttempts}: ${uploadStatus}`);
    }
    
    if (uploadStatus !== 'SUCCEEDED') {
      throw new Error(`Upload failed with status: ${uploadStatus} after ${attempts} attempts`);
    }
    
    console.log('Upload completed successfully!');
    return upload.arn;
    
  } catch (error) {
    console.error('Error in uploadToDeviceFarm:', error);
    throw error;
  }
}

// Background processing function for local Device Farm calls
async function processDeviceFarmDirectly(jobId: string, params: any) {
  const { 
    projectArn,
    devicePoolArn,
    platform,
    buildPath,
    testSpecPath,
    testType,
    testMode,
    test,
    testCase
  } = params;

  try {
    console.log(`[${jobId}] Starting Device Farm processing...`);
    
    const client = getDeviceFarmClient();
    const projectRoot = path.join(process.cwd(), '..');
    
    // Upload app
    console.log(`[${jobId}] Uploading app to Device Farm...`);
    const appPath = path.join(projectRoot, buildPath);
    const appArn = await uploadToDeviceFarm(
      client, 
      projectArn, 
      appPath, 
      platform === 'android' ? 'ANDROID_APP' : 'IOS_APP'
    );
    
    // Upload test package (your test bundle)
    console.log(`[${jobId}] Uploading test package...`);
    const testPackagePath = path.join(projectRoot, 'test-bundle.zip');
    
    // Always recreate test bundle to ensure latest code
    console.log(`[${jobId}] Creating fresh test bundle with latest code...`);
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Remove old bundle if exists
    try {
      await fs.unlink(testPackagePath);
    } catch (e) {
      // File doesn't exist, that's fine
    }
    
    // List files before zipping to verify Device Farm config exists
    await execAsync('ls -la config/', { cwd: projectRoot });
    
    await execAsync('zip -r test-bundle.zip test/ config/ package.json tsconfig.json', {
      cwd: projectRoot
    });
    
    // Verify the bundle includes Device Farm config
    console.log(`[${jobId}] Verifying test bundle contents...`);
    await execAsync('unzip -l test-bundle.zip | grep devicefarm', {
      cwd: projectRoot
    }).catch(() => console.log(`[${jobId}] Device Farm config not found in bundle`));
    
    // Force fresh upload of test package (no caching)
    const testPackageArn = await uploadToDeviceFarmNoCache(
      client,
      projectArn,
      testPackagePath,
      'APPIUM_NODE_TEST_PACKAGE'
    );
    
    // Create dynamic test spec with test parameters
    let testSpecArn;
    if (testSpecPath) {
      console.log(`[${jobId}] Creating dynamic test spec with parameters...`);
      const specPath = path.join(projectRoot, testSpecPath);
      
      // Read the base test spec
      const baseTestSpec = await fs.readFile(specPath, 'utf-8');
      
      // Create a dynamic test spec with test selection parameters as exports
      // Insert export commands right before the test phase
      let dynamicTestSpec = baseTestSpec;
      
      // Find the test phase and insert our exports before it
      const testPhaseIndex = dynamicTestSpec.indexOf('  test:');
      if (testPhaseIndex !== -1) {
        const insertPoint = dynamicTestSpec.indexOf('commands:', testPhaseIndex) + 'commands:'.length;
        
        // Prepare the export commands based on test selection
        let exportCommands = '\n';
        if (testMode === 'single' && test) {
          exportCommands += `      - export TEST_MODE="single"\n`;
          exportCommands += `      - export SELECTED_TEST="${test}"\n`;
          if (testCase) {
            exportCommands += `      - export SELECTED_TEST_CASE="${testCase}"\n`;
          }
        } else {
          exportCommands += `      - export TEST_MODE="full"\n`;
        }
        exportCommands += '      - echo "=== Injected Test Parameters ==="\n';
        exportCommands += '      - echo TEST_MODE=$TEST_MODE\n';
        exportCommands += '      - echo SELECTED_TEST=$SELECTED_TEST\n';
        exportCommands += '      - echo SELECTED_TEST_CASE=$SELECTED_TEST_CASE\n';
        
        // Insert the export commands
        dynamicTestSpec = 
          dynamicTestSpec.slice(0, insertPoint) + 
          exportCommands + 
          dynamicTestSpec.slice(insertPoint);
      }
      
      // Save the dynamic test spec
      const dynamicSpecPath = path.join(projectRoot, 'device-farm-testspec-dynamic.yml');
      await fs.writeFile(dynamicSpecPath, dynamicTestSpec);
      console.log(`[${jobId}] Dynamic test spec created with parameters`);
      
      // Upload the dynamic test spec (force fresh upload)
      testSpecArn = await uploadToDeviceFarmNoCache(
        client,
        projectArn,
        dynamicSpecPath,
        'APPIUM_NODE_TEST_SPEC'
      );
    }
    
    // Schedule the run
    console.log(`[${jobId}] Scheduling test run...`);
    
    // Log what mode we're running in
    if (testMode === 'single' && test) {
      console.log(`[${jobId}] Running single test: ${test}${testCase ? ` - ${testCase}` : ''}`);
    } else {
      console.log(`[${jobId}] Running full test suite`);
    }
    
    const scheduleRunCommand = new ScheduleRunCommand({
      projectArn,
      appArn,
      devicePoolArn,
      name: `Test Run - ${new Date().toISOString()}`,
      test: {
        type: testType as TestType,
        testPackageArn,
        testSpecArn
      }
    });
    
    const { run } = await client.send(scheduleRunCommand);
    
    if (!run?.arn) {
      throw new Error('Failed to schedule run');
    }
    
    console.log(`[${jobId}] Device Farm run scheduled successfully: ${run.arn}`);
    
    // Save to test history
    try {
      const testName = testMode === 'single' && test ? 
        test.split('/').pop()?.replace('.e2e.ts', '') || 'Device Farm Test' : 
        'Full Test Suite';
      
      const historyEntry = {
        id: run.arn?.split('/').pop() || jobId,
        name: testName,
        status: 'RUNNING',
        created: new Date().toISOString(),
        device: 'AWS Device Farm',
        platform: platform === 'android' ? 'android' : 'ios',
        build: buildPath.split('/').pop() || 'app.apk',
        runArn: run.arn,
        isDeviceFarm: true,
        testMode,
        test: test || null,
        testCase: testCase || null
      };
      
      await fetch(`http://localhost:3002/api/test/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(historyEntry)
      });
    } catch (error) {
      console.error(`[${jobId}] Failed to save to history:`, error);
    }
    
  } catch (error) {
    console.error(`[${jobId}] Device Farm processing failed:`, error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      projectArn,
      devicePoolArn,
      platform,
      buildPath,
      testSpecPath,
      testType = 'APPIUM_NODE',
      testMode,
      testSuite: test, // Rename for compatibility with original code
      testCase
    } = body;
    
    if (!projectArn || !devicePoolArn || !buildPath) {
      return NextResponse.json({ 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    // Check if this is running on AWS deployment (has API URL)
    const isAWSDeployment = Boolean(process.env.NEXT_PUBLIC_API_URL);
    
    if (isAWSDeployment) {
      // AWS deployment - proxy to Lambda which is already async
      console.log('AWS deployment detected - proxying to Lambda...');
      try {
        const lambdaResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/device-farm/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        
        const lambdaData = await lambdaResponse.json();
        return NextResponse.json(lambdaData, { status: lambdaResponse.status });
      } catch (proxyError) {
        console.error('Failed to proxy to Lambda:', proxyError);
        return NextResponse.json({ 
          error: 'Failed to connect to AWS Lambda' 
        }, { status: 502 });
      }
    }

    // Local development - return immediately and process in background
    const jobId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`Local development - starting Device Farm job ${jobId} in background`);
    
    // Start background processing (don't await)
    processDeviceFarmDirectly(jobId, {
      projectArn,
      devicePoolArn,
      platform,
      buildPath,
      testSpecPath,
      testType,
      testMode,
      test,
      testCase
    }).catch(error => {
      console.error(`Background Device Farm processing failed for job ${jobId}:`, error);
    });
    
    // Return immediately
    return NextResponse.json({
      runArn: `local:${jobId}`,
      status: 'SCHEDULING',
      message: 'Device Farm test is being scheduled in background...',
      jobId
    });
    
  } catch (error: any) {
    console.error('Failed to run Device Farm test:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check test run status
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
    
    return NextResponse.json({
      status: run?.status,
      result: run?.result,
      counters: run?.counters,
      totalJobs: run?.totalJobs,
      completedJobs: run?.completedJobs,
      message: run?.message,
      started: run?.started,
      stopped: run?.stopped
    });
  } catch (error: any) {
    console.error('Failed to get run status:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}