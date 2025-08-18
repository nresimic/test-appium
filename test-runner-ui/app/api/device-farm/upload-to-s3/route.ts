import { NextResponse } from 'next/server';
import { 
  DeviceFarmClient,
  ListArtifactsCommand,
  ArtifactCategory
} from '@aws-sdk/client-device-farm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';

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

const getS3Client = () => {
  return new S3Client({
    region: 'eu-west-1', // Reports bucket is in eu-west-1
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN
    } : undefined
  });
};

export async function POST(request: Request) {
  try {
    const { runArn } = await request.json();
    
    if (!runArn) {
      return NextResponse.json({ 
        error: 'Missing runArn parameter' 
      }, { status: 400 });
    }
    
    console.log('Starting S3 upload for Device Farm run:', runArn);
    
    const deviceFarmClient = getDeviceFarmClient();
    const s3Client = getS3Client();
    
    // List artifacts for the run
    const listCommand = new ListArtifactsCommand({
      arn: runArn,
      type: 'FILE' as ArtifactCategory
    });
    
    const { artifacts } = await deviceFarmClient.send(listCommand);
    
    if (!artifacts || artifacts.length === 0) {
      return NextResponse.json({ 
        error: 'No artifacts found for this run'
      }, { status: 404 });
    }
    
    // Look for the single HTML Allure report
    const allureReport = artifacts.find(artifact => 
      artifact.name?.includes('allure-report-complete.html')
    );
    
    if (!allureReport?.url) {
      return NextResponse.json({ 
        error: 'No Allure report found in artifacts'
      }, { status: 404 });
    }
    
    console.log('Found Allure report, downloading:', allureReport.name);
    
    // Download the HTML report
    const response = await fetch(allureReport.url);
    if (!response.ok) {
      throw new Error(`Failed to download report: ${response.statusText}`);
    }
    
    const htmlContent = await response.buffer();
    
    // Generate S3 key
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const runId = runArn.split('/').pop() || 'unknown';
    const s3Key = `allure/device-farm-${timestamp}-${runId}.html`;
    
    console.log('Uploading to S3:', s3Key);
    
    // Upload to S3
    const putCommand = new PutObjectCommand({
      Bucket: 'vault22-test-reports',
      Key: s3Key,
      Body: htmlContent,
      ContentType: 'text/html',
      Metadata: {
        'run-arn': runArn,
        'generated': new Date().toISOString(),
        'source': 'device-farm-webhook'
      }
    });
    
    await s3Client.send(putCommand);
    
    const s3Url = `https://vault22-test-reports.s3.eu-west-1.amazonaws.com/${s3Key}`;
    
    console.log('✅ Report uploaded successfully:', s3Url);
    
    return NextResponse.json({
      success: true,
      s3Url,
      message: 'Allure report uploaded to S3 successfully'
    });
    
  } catch (error: any) {
    console.error('Failed to upload report to S3:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}