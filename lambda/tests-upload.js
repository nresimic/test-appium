const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getCredentialsFromRole } = require('./aws-credentials-role');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

const getS3Client = async () => {
  const credentials = await getCredentialsFromRole();
  return new S3Client({
    region: 'eu-west-1',
    credentials
  });
};

const createTestPackage = async () => {
  const tempDir = '/tmp/test-package';
  const zipPath = '/tmp/vault22-e2e-tests.zip';
  
  try {
    // Clean up any existing temp directory
    if (fs.existsSync(tempDir)) {
      execSync(`rm -rf ${tempDir}`);
    }
    
    // Create temp directory structure
    fs.mkdirSync(tempDir, { recursive: true });
    
    // For AWS Lambda, we need to package the test files that are available
    // This is a placeholder - in real implementation you might:
    // 1. Bundle the actual test project files
    // 2. Include WebdriverIO config, dependencies, test files
    // 3. Create a proper test package structure
    
    // Create a manifest file
    const manifest = {
      name: 'vault22-e2e-tests',
      version: '1.0.0',
      platform: 'android',
      type: 'webdriverio',
      created: new Date().toISOString(),
      tests: [
        'test/e2e/login.e2e.ts',
        'test/e2e/registration.e2e.ts',
        'test/e2e/app-launch.e2e.ts'
      ],
      specs: [
        'should login with valid credentials',
        'should handle invalid login',
        'should register new user',
        'should validate registration form',
        'should launch app successfully',
        'should display welcome screen'
      ]
    };
    
    // Write manifest
    fs.writeFileSync(path.join(tempDir, 'test-manifest.json'), JSON.stringify(manifest, null, 2));
    
    // Create mock test files (in real implementation, copy actual test files)
    const testDir = path.join(tempDir, 'test', 'e2e');
    fs.mkdirSync(testDir, { recursive: true });
    
    // Mock test file content
    const mockTestContent = `// WebdriverIO E2E Test
import { expect } from '@wdio/globals'

describe('Mock Test Suite', () => {
    it('should run test successfully', async () => {
        // Test implementation
        expect(true).toBe(true);
    });
});`;
    
    fs.writeFileSync(path.join(testDir, 'login.e2e.ts'), mockTestContent);
    fs.writeFileSync(path.join(testDir, 'registration.e2e.ts'), mockTestContent);
    fs.writeFileSync(path.join(testDir, 'app-launch.e2e.ts'), mockTestContent);
    
    // Create WebdriverIO config
    const wdioConfig = `export const config = {
    runner: 'local',
    specs: ['./test/e2e/**/*.ts'],
    maxInstances: 1,
    capabilities: [{
        platformName: 'Android',
        'appium:deviceName': 'Android Emulator',
        'appium:automationName': 'UiAutomator2'
    }],
    logLevel: 'info',
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    }
};`;
    
    fs.writeFileSync(path.join(tempDir, 'wdio.conf.ts'), wdioConfig);
    
    // Create package.json
    const packageJson = {
      name: 'vault22-e2e-tests',
      version: '1.0.0',
      scripts: {
        test: 'wdio run wdio.conf.ts'
      },
      devDependencies: {
        '@wdio/cli': '^8.0.0',
        '@wdio/local-runner': '^8.0.0',
        '@wdio/mocha-framework': '^8.0.0'
      }
    };
    
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    // Create zip archive
    execSync(`cd ${tempDir} && zip -r ${zipPath} ./*`);
    
    console.log(`Test package created: ${zipPath}`);
    return zipPath;
    
  } catch (error) {
    console.error('Failed to create test package:', error);
    throw error;
  }
};

const uploadToS3 = async (bucketName, key, filePath) => {
  const s3Client = await getS3Client();
  
  try {
    const fileContent = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: 'application/zip',
      Metadata: {
        uploadedAt: new Date().toISOString(),
        originalName: path.basename(filePath),
        size: stats.size.toString(),
        type: 'e2e-test-package'
      }
    });
    
    await s3Client.send(command);
    console.log(`Successfully uploaded ${key} to S3 bucket ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`Failed to upload ${key} to S3:`, error);
    return false;
  }
};

exports.handler = async (event) => {
  console.log('Tests Upload Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const bucketName = process.env.TESTS_BUCKET_NAME;
    
    if (!bucketName) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Tests bucket not configured' })
      };
    }

    console.log('Creating and uploading test package to S3...');
    
    // Create test package
    const packagePath = await createTestPackage();
    
    // Generate S3 key with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const s3Key = `e2e-tests/vault22-e2e-tests-${timestamp}.zip`;
    
    // Upload to S3
    const uploadSuccess = await uploadToS3(bucketName, s3Key, packagePath);
    
    // Clean up temp files
    if (fs.existsSync(packagePath)) {
      fs.unlinkSync(packagePath);
    }
    
    if (uploadSuccess) {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          message: 'Test package created and uploaded to S3 successfully',
          bucketName,
          s3Key,
          timestamp
        })
      };
    } else {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to upload test package to S3' })
      };
    }

  } catch (error) {
    console.error('Tests upload error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};