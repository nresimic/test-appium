import { NextResponse } from 'next/server';
import { 
  DeviceFarmClient,
  ListArtifactsCommand,
  ArtifactCategory
} from '@aws-sdk/client-device-farm';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
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
    region: process.env.AWS_REGION || 'us-west-2',
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN
    } : undefined
  });
};

const checkIfReportExistsInS3 = async (runArn: string): Promise<string | null> => {
  try {
    const s3Client = getS3Client();
    const runId = runArn.split('/').pop() || 'unknown';
    
    // Try to find existing report with the same runId
    // We need to generate possible S3 keys and check if they exist
    const bucketName = 'vault-test-reports-new';
    const keyPrefix = `allure/device-farm-`;
    const keySuffix = `-${runId}.html`;
    
    // For now, we can't easily list all objects, so we'll generate a consistent key
    // based on the runArn instead of timestamp
    const consistentKey = `allure/device-farm-${runId}.html`;
    
    const headCommand = new HeadObjectCommand({
      Bucket: bucketName,
      Key: consistentKey
    });
    
    await s3Client.send(headCommand);
    
    // If no error, the object exists
    return `https://${bucketName}.s3.us-west-2.amazonaws.com/${consistentKey}`;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return null; // Object doesn't exist
    }
    console.error('Error checking S3 object:', error);
    return null; // Assume doesn't exist on other errors
  }
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runArn = searchParams.get('runArn');
  
  if (!runArn) {
    return NextResponse.json({ 
      error: 'Missing runArn parameter' 
    }, { status: 400 });
  }
  
  try {
    // First, check if report already exists in S3
    const existingS3Url = await checkIfReportExistsInS3(runArn);
    
    if (existingS3Url) {
      return NextResponse.json({
        hasReport: true,
        reportUrl: existingS3Url,
        reportName: 'Allure Report (S3)',
        message: 'Allure report already available in S3',
        artifactType: 'html',
        requiresExtraction: false,
        source: 's3-cached'
      });
    }
    
    const client = getDeviceFarmClient();
    
    // List all artifacts for the run
    const listCommand = new ListArtifactsCommand({
      arn: runArn,
      type: 'FILE' as ArtifactCategory
    });
    
    const { artifacts } = await client.send(listCommand);
    
    if (!artifacts || artifacts.length === 0) {
      return NextResponse.json({ 
        message: 'No artifacts found for this run',
        hasReport: false
      });
    }
    
    // Check for S3 report URL in artifacts first (v8+ testspec)
    const reportInfoArtifact = artifacts.find(artifact => 
      artifact.name?.includes('report-info.txt')
    );
    
    if (reportInfoArtifact?.url) {
      try {
        // Download and parse the report info file to get S3 URL
        const response = await fetch(reportInfoArtifact.url);
        const reportInfo = await response.text();
        const s3UrlMatch = reportInfo.match(/S3_REPORT_URL=(.+)/);
        
        if (s3UrlMatch && s3UrlMatch[1]) {
          return NextResponse.json({
            hasReport: true,
            reportUrl: s3UrlMatch[1].trim(),
            reportName: 'Allure Report (S3)',
            message: 'Direct S3 Allure report available',
            artifactType: 'html',
            requiresExtraction: false,
            source: 's3'
          });
        }
      } catch (error) {
        console.error('Failed to fetch S3 URL from report-info:', error);
      }
    }
    
    // Fallback: Look for single HTML file and offer to upload to S3
    const singleHtmlReport = artifacts.find(artifact => 
      artifact.name?.includes('allure-report-complete.html')
    );
    
    if (singleHtmlReport?.url) {
      // Try to upload to S3 automatically
      try {
        console.log('Found Allure report, attempting S3 upload...');
        const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'}/api/device-farm/upload-to-s3`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runArn })
        });
        
        if (uploadResponse.ok) {
          const uploadData: any = await uploadResponse.json();
          if (uploadData.success && uploadData.s3Url) {
            console.log('✅ Auto-uploaded to S3:', uploadData.s3Url);
            return NextResponse.json({
              hasReport: true,
              reportUrl: uploadData.s3Url,
              reportName: 'Allure Report (S3)',
              message: 'Allure report auto-uploaded to S3',
              artifactType: 'html',
              requiresExtraction: false,
              source: 's3-auto'
            });
          }
        }
        
        console.log('S3 upload failed, falling back to Device Farm URL');
      } catch (error) {
        console.error('S3 upload error:', error);
      }
      
      // Fallback to direct Device Farm URL
      return NextResponse.json({
        hasReport: true,
        reportUrl: singleHtmlReport.url,
        reportName: singleHtmlReport.name,
        message: 'Single-file Allure report available (Device Farm)',
        artifactType: 'html',
        requiresExtraction: false,
        source: 'device-farm'
      });
    }
    
    // Check Customer Artifacts zip for allure-report-complete.html
    const customerArtifactsZip = artifacts.find(artifact => 
      (artifact.name?.includes('Customer Artifacts') && artifact.extension === 'zip')
    );
    
    if (customerArtifactsZip?.url) {
      // Try to extract and upload the HTML report from the zip
      try {
        console.log('Found Customer Artifacts, attempting to extract Allure report...');
        const uploadResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'}/api/device-farm/extract-and-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            zipUrl: customerArtifactsZip.url,
            runArn 
          })
        });
        
        if (uploadResponse.ok) {
          const uploadData: any = await uploadResponse.json();
          if (uploadData.success && uploadData.s3Url) {
            console.log('✅ Extracted and uploaded to S3:', uploadData.s3Url);
            return NextResponse.json({
              hasReport: true,
              reportUrl: uploadData.s3Url,
              reportName: 'Allure Report (S3)',
              message: 'Allure report extracted and uploaded to S3',
              artifactType: 'html',
              requiresExtraction: false,
              source: 's3-extracted'
            });
          }
        }
        
        console.log('Extraction failed, offering zip download');
      } catch (error) {
        console.error('Extraction error:', error);
      }
      
      // Fallback: offer zip download
      return NextResponse.json({
        hasReport: true,
        reportUrl: customerArtifactsZip.url,
        reportName: customerArtifactsZip.name,
        message: 'Customer artifacts available (contains Allure report)',
        artifactType: 'zip',
        requiresExtraction: true,
        source: 'device-farm',
        instructions: 'Download and extract the zip file, then open Host_Machine_Files/$DEVICEFARM_LOG_DIR/allure-report-complete.html in your browser'
      });
    }
    
    return NextResponse.json({
      hasReport: false,
      message: 'No Allure report found in artifacts',
      availableArtifacts: artifacts.map(a => ({
        name: a.name,
        type: a.type,
        extension: a.extension
      }))
    });
    
  } catch (error: any) {
    console.error('Failed to fetch report:', error);
    return NextResponse.json({ 
      error: error.message,
      hasReport: false
    }, { status: 500 });
  }
}