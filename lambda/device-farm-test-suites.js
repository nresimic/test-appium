const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const yauzl = require('yauzl');
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

// Extract test names from JavaScript/TypeScript content
function extractTestsFromContent(content) {
  // Extract test names from it() and it.only() blocks
  const testPattern = /it(?:\.only)?\s*\(\s*['"`]([^'"`]+)['"`]/g;
  const tests = [];
  let match;
  
  while ((match = testPattern.exec(content)) !== null) {
    tests.push(match[1]);
  }
  
  return tests;
}

// Get suite name from file path
function getSuiteName(filePath) {
  const fileName = filePath.split('/').pop()?.replace('.e2e.ts', '').replace('.e2e.js', '') || '';
  return fileName
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

exports.handler = async (event) => {
  console.log('Device Farm Test Suites Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    try {
      const s3Client = await getS3Client();
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
      const chunks = [];
      for await (const chunk of getObjectResponse.Body) {
        chunks.push(chunk);
      }
      const zipBuffer = Buffer.concat(chunks);
      
      // Parse the ZIP file and extract test information
      const testSuites = {};
      
      return new Promise((resolve, reject) => {
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
          
          zipfile.on('entry', (entry) => {
            // Only process .e2e.ts and .e2e.js files
            if (entry.fileName.endsWith('.e2e.ts') || entry.fileName.endsWith('.e2e.js')) {
              zipfile.openReadStream(entry, (err, readStream) => {
                if (err) {
                  console.error('Error reading entry:', err);
                  zipfile.readEntry();
                  return;
                }
                
                const chunks = [];
                readStream.on('data', (chunk) => chunks.push(chunk));
                readStream.on('end', () => {
                  const content = Buffer.concat(chunks).toString('utf-8');
                  const tests = extractTestsFromContent(content);
                  // Use the full file path instead of transformed name
                  const filePath = entry.fileName;
                  
                  if (tests.length > 0) {
                    testSuites[filePath] = tests;
                  }
                  
                  zipfile.readEntry();
                });
                readStream.on('error', (err) => {
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
            resolve({
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({ testSuites })
            });
          });
          
          zipfile.on('error', (err) => {
            console.error('ZIP file error:', err);
            reject(err);
          });
        });
      });
      
    } catch (error) {
      console.error('Error fetching test suites:', error);
      
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Failed to fetch test suites from S3' })
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};