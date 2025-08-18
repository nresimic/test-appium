const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
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

// Extract test names from test files
function extractTestsFromContent(content, fileName) {
  const tests = [];
  
  // For TypeScript/JavaScript test files
  if (fileName.match(/\.(ts|js)$/)) {
    // Match describe blocks
    const describeMatches = content.match(/describe\s*\(\s*['"`]([^'"`,]+)['"`]/g);
    if (describeMatches) {
      describeMatches.forEach(match => {
        const testName = match.match(/['"`]([^'"`,]+)['"`]/)?.[1];
        if (testName) {
          tests.push(testName);
        }
      });
    }
    
    // Match it blocks as individual tests
    const itMatches = content.match(/it\s*\(\s*['"`]([^'"`,]+)['"`]/g);
    if (itMatches) {
      itMatches.forEach(match => {
        const testName = match.match(/['"`]([^'"`,]+)['"`]/)?.[1];
        if (testName) {
          tests.push(testName);
        }
      });
    }
  }
  
  return tests;
}

// Extract tests from ZIP file
async function extractTestsFromZip(s3Client, bucketName, zipKey) {
  try {
    console.log(`Extracting tests from ZIP: ${zipKey}`);
    
    // Download ZIP file from S3
    const getObjectResponse = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: zipKey
    }));
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of getObjectResponse.Body) {
      chunks.push(chunk);
    }
    const zipBuffer = Buffer.concat(chunks);
    
    // Parse ZIP file
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    const allTests = [];
    
    // Process each file in the ZIP
    zipEntries.forEach(entry => {
      const fileName = entry.entryName;
      
      // Only process test files
      if (fileName.includes('/test/') || fileName.includes('/e2e/') || fileName.endsWith('.e2e.ts') || fileName.endsWith('.test.ts')) {
        const content = entry.getData().toString('utf8');
        const tests = extractTestsFromContent(content, fileName);
        allTests.push(...tests);
      }
    });
    
    // Remove duplicates and filter out empty
    const uniqueTests = [...new Set(allTests)].filter(test => test && test.trim());
    
    console.log(`Extracted ${uniqueTests.length} tests:`, uniqueTests);
    return uniqueTests;
    
  } catch (error) {
    console.error('Error extracting tests from ZIP:', error);
    return [];
  }
}

exports.handler = async (event) => {
  console.log('Tests Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
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

    const s3Client = await getS3Client();
    
    console.log(`Listing test packages from S3 bucket: ${bucketName}`);
    
    // List test package files in S3
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 100
    });
    
    const response = await s3Client.send(command);
    const objects = response.Contents || [];
    
    console.log(`Found ${objects.length} objects in tests bucket`);
    
    // Filter and format test packages
    const testPackages = [];
    
    for (const obj of objects.filter(obj => {
      const key = obj.Key || '';
      return key.endsWith('.zip') || key.endsWith('.tar.gz');
    })) {
      const key = obj.Key || '';
      const filename = key.split('/').pop() || key;
      const name = filename.replace(/\.(zip|tar\.gz)$/, '');
      
      // Extract platform from filename or path
      const platform = key.toLowerCase().includes('android') ? 'android' : 
                       key.toLowerCase().includes('ios') ? 'ios' : 'android';
      
      // Extract test type
      const type = name.toLowerCase().includes('e2e') ? 'e2e' : 
                   name.toLowerCase().includes('unit') ? 'unit' : 'e2e';
      
      // Extract actual tests from ZIP file
      const tests = key.endsWith('.zip') ? 
        await extractTestsFromZip(s3Client, bucketName, key) : 
        ['Tests not extractable from tar.gz files'];
      
      testPackages.push({
        id: key.replace(/[/.]/g, '-'),
        name: name.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        filename,
        path: key,
        type,
        platform,
        size: obj.Size || 0,
        created: obj.LastModified?.toISOString() || new Date().toISOString(),
        s3Key: key,
        tests
      });
    }
    
    // Sort by creation date
    testPackages.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    console.log(`Returning ${testPackages.length} test packages`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        testFiles: testPackages,
        tests: testPackages,
        bucketName,
        totalObjects: objects.length,
        message: testPackages.length === 0 ? 
          'No test packages found. Upload zipped test suites to S3 bucket.' : 
          `Found ${testPackages.length} test packages`
      })
    };

  } catch (error) {
    console.error('Tests error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};