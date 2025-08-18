import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  let tempDir: string | null = null;
  
  try {
    const { zipUrl, runArn } = await request.json();
    
    if (!zipUrl || !runArn) {
      return NextResponse.json({ 
        error: 'Missing zipUrl or runArn parameter' 
      }, { status: 400 });
    }
    
    console.log('Extracting Allure report from Customer Artifacts for run:', runArn);
    
    const s3Client = getS3Client();
    
    // Create temp directory
    tempDir = path.join('/tmp', `device-farm-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    
    const zipPath = path.join(tempDir, 'artifacts.zip');
    
    // Download the zip file
    console.log('Downloading Customer Artifacts zip...');
    const response = await fetch(zipUrl);
    if (!response.ok) {
      throw new Error(`Failed to download zip: ${response.statusText}`);
    }
    
    const zipBuffer = await response.buffer();
    await fs.writeFile(zipPath, zipBuffer);
    
    // Extract zip
    console.log('Extracting zip file...');
    await execAsync(`unzip -q "${zipPath}" -d "${tempDir}"`);
    
    // Look for the Allure HTML report
    const expectedPaths = [
      path.join(tempDir, 'Host_Machine_Files', '$DEVICEFARM_LOG_DIR', 'allure-report-complete.html'),
      path.join(tempDir, 'Host_Machine_Files', 'DEVICEFARM_LOG_DIR', 'allure-report-complete.html')
    ];
    
    let htmlPath: string | null = null;
    for (const expectedPath of expectedPaths) {
      try {
        await fs.access(expectedPath);
        htmlPath = expectedPath;
        console.log('Found Allure report at:', expectedPath);
        break;
      } catch {
        // Try next path
      }
    }
    
    if (!htmlPath) {
      // List directory contents for debugging
      try {
        const { stdout } = await execAsync(`find "${tempDir}" -name "*.html" -type f`);
        console.log('HTML files found in extraction:', stdout);
        
        // Try to find any HTML file that might be the report
        const htmlFiles = stdout.trim().split('\n').filter(f => f.includes('allure'));
        if (htmlFiles.length > 0) {
          htmlPath = htmlFiles[0];
          console.log('Using fallback HTML file:', htmlPath);
        }
      } catch (findError) {
        console.error('Failed to search for HTML files:', findError);
      }
    }
    
    if (!htmlPath) {
      throw new Error('allure-report-complete.html not found in Customer Artifacts');
    }
    
    // Read the HTML content
    const htmlContent = await fs.readFile(htmlPath);
    
    // Generate consistent S3 key based on runId (not timestamp)
    const runId = runArn.split('/').pop() || 'unknown';
    const s3Key = `allure/device-farm-${runId}.html`;
    
    console.log('Uploading extracted report to S3:', s3Key);
    
    // Upload to S3
    const putCommand = new PutObjectCommand({
      Bucket: 'vault22-test-reports',
      Key: s3Key,
      Body: htmlContent,
      ContentType: 'text/html',
      Metadata: {
        'run-arn': runArn,
        'generated': new Date().toISOString(),
        'source': 'device-farm-extraction'
      }
    });
    
    await s3Client.send(putCommand);
    
    const s3Url = `https://vault22-test-reports.s3.eu-west-1.amazonaws.com/${s3Key}`;
    
    console.log('✅ Report extracted and uploaded successfully:', s3Url);
    
    return NextResponse.json({
      success: true,
      s3Url,
      message: 'Allure report extracted from Customer Artifacts and uploaded to S3'
    });
    
  } catch (error: any) {
    console.error('Failed to extract and upload report:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  } finally {
    // Cleanup temp directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (cleanupError) {
        console.error('Failed to cleanup temp directory:', cleanupError);
      }
    }
  }
}