import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import * as yauzl from 'yauzl';
import * as fs from 'fs';
import * as path from 'path';

const getS3Client = () => {
  const awsProfile = process.env.AWS_PROFILE;
  
  if (awsProfile) {
    process.env.AWS_PROFILE = awsProfile;
    return new S3Client({
      region: process.env.AWS_REGION || 'us-west-2'
    });
  }
  
  return new S3Client({
    region: process.env.AWS_REGION || 'us-west-2',
    credentials: process.env.AWS_ACCESS_KEY_ID ? {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      sessionToken: process.env.AWS_SESSION_TOKEN
    } : undefined
  });
};

// Extract test names from JavaScript/TypeScript content
function extractTestsFromContent(content: string): string[] {
  // Extract test names from it() and it.only() blocks
  const testPattern = /it(?:\.only)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const tests: string[] = [];
  let match;
  
  while ((match = testPattern.exec(content)) !== null) {
    tests.push(match[1]);
  }
  
  return tests;
}

// Get suite name from file path
function getSuiteName(filePath: string): string {
  const fileName = filePath.split('/').pop()?.replace('.e2e.ts', '').replace('.e2e.js', '') || '';
  return fileName
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function GET(): Promise<NextResponse> {
  try {
    const s3Client = getS3Client();
    const bucketName = process.env.TESTS_BUCKET_NAME || 'vault22-tests';
    const testPackageKey = 'device-farm-test-package.zip';
    
    console.log(`Fetching test package from S3: ${bucketName}/${testPackageKey}`);
    
    // Download the test package from S3
    const getObjectResponse = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: testPackageKey
    }));
    
    if (!getObjectResponse.Body) {
      throw new Error('No test package found in S3');
    }
    
    // Convert the stream to buffer
    const chunks: Buffer[] = [];
    const stream = getObjectResponse.Body as Readable;
    
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    const zipBuffer = Buffer.concat(chunks);
    
    // Parse the ZIP file and extract test information
    const testSuites: { [key: string]: string[] } = {};
    
    return new Promise<NextResponse>((resolve, reject) => {
      yauzl.fromBuffer(zipBuffer, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          console.error('Error reading ZIP file:', err);
          reject(err);
          return;
        }
        
        if (!zipfile) {
          reject(new Error('Failed to parse ZIP file'));
          return;
        }
        
        zipfile.readEntry();
        
        zipfile.on('entry', (entry: any) => {
          // Only process .e2e.ts and .e2e.js files
          if (entry.fileName.endsWith('.e2e.ts') || entry.fileName.endsWith('.e2e.js')) {
            zipfile.openReadStream(entry, (err: any, readStream: any) => {
              if (err) {
                console.error('Error reading entry:', err);
                zipfile.readEntry();
                return;
              }
              
              const chunks: Buffer[] = [];
              readStream.on('data', (chunk: Buffer) => chunks.push(chunk));
              readStream.on('end', () => {
                const content = Buffer.concat(chunks).toString('utf-8');
                const tests = extractTestsFromContent(content);
                const suiteName = getSuiteName(entry.fileName);
                
                if (tests.length > 0) {
                  testSuites[suiteName] = tests;
                }
                
                zipfile.readEntry();
              });
              readStream.on('error', (err: any) => {
                console.error('Error reading stream:', err);
                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });
        
        zipfile.on('end', () => {
          console.log('Found test suites:', Object.keys(testSuites));
          resolve(NextResponse.json({ testSuites }));
        });
        
        zipfile.on('error', (err: any) => {
          console.error('ZIP file error:', err);
          reject(err);
        });
      });
    });
    
  } catch (error: any) {
    console.error('Error fetching test suites:', error);
    
    // Fallback to hardcoded suites if S3 fetch fails
    const fallbackSuites = {
      'Login Flow': [
        'Should login successfully with user having bank account @ios @android @auth @smoke',
        'Should login successfully with user without bank account',
        'Should show error for invalid OTP',
        'Should show error for expired OTP'
      ],
      'Registration': [
        'Should register new user successfully',
        'Should validate email format',
        'Should validate phone number'
      ]
    };
    
    console.log('Using fallback test suites');
    return NextResponse.json({ testSuites: fallbackSuites });
  }
}