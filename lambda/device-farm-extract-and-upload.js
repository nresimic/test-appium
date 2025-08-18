const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { promises: fs } = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
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

// Recursively find HTML files
async function findHtmlFiles(dir) {
  const htmlFiles = [];
  
  async function searchDir(currentDir) {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          htmlFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Failed to read directory ${currentDir}:`, error);
    }
  }
  
  await searchDir(dir);
  return htmlFiles;
}

exports.handler = async (event) => {
  console.log('Device Farm Extract and Upload Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'POST') {
    let tempDir = null;
    
    try {
      const body = JSON.parse(event.body || '{}');
      const { zipUrl, runArn } = body;
      
      if (!zipUrl || !runArn) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing zipUrl or runArn parameter' })
        };
      }
      
      console.log('Extracting Allure report from Customer Artifacts for run:', runArn);
      
      const s3Client = await getS3Client();
      
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
      
      const arrayBuffer = await response.arrayBuffer();
      const zipBuffer = Buffer.from(arrayBuffer);
      await fs.writeFile(zipPath, zipBuffer);
      
      // Extract zip using Node.js library (no system unzip command needed)
      console.log('Extracting zip file...');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(tempDir, true);
      
      // Look for the Allure HTML report
      const expectedPaths = [
        path.join(tempDir, 'Host_Machine_Files', '$DEVICEFARM_LOG_DIR', 'allure-report-complete.html'),
        path.join(tempDir, 'Host_Machine_Files', 'DEVICEFARM_LOG_DIR', 'allure-report-complete.html')
      ];
      
      let htmlPath = null;
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
        // Search for HTML files recursively using Node.js
        try {
          console.log('Searching for HTML files recursively...');
          const htmlFiles = await findHtmlFiles(tempDir);
          console.log('HTML files found in extraction:', htmlFiles);
          
          // Try to find any HTML file that might be the report
          const allureFiles = htmlFiles.filter(f => f.includes('allure'));
          if (allureFiles.length > 0) {
            htmlPath = allureFiles[0];
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
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          s3Url,
          message: 'Allure report extracted from Customer Artifacts and uploaded to S3'
        })
      };
      
    } catch (error) {
      console.error('Failed to extract and upload report:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message })
      };
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

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};