import { NextResponse } from 'next/server';
import { DeviceFarmClient, ListProjectsCommand } from '@aws-sdk/client-device-farm';

// Initialize Device Farm client
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

export async function GET() {
  try {
    const client = getDeviceFarmClient();
    const command = new ListProjectsCommand({});
    const response = await client.send(command);
    
    return NextResponse.json({
      projects: response.projects || []
    });
  } catch (error: any) {
    console.error('Failed to list Device Farm projects:', error);
    return NextResponse.json({ 
      error: error.message,
      hint: 'Make sure AWS credentials are configured in environment variables'
    }, { status: 500 });
  }
}