const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
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

// Load test history from S3
async function loadHistoryFromS3() {
  try {
    const s3Client = await getS3Client();
    const bucketName = process.env.TESTS_BUCKET_NAME || 'vault22-tests';
    const historyKey = 'test-history.json';
    
    const getObjectResponse = await s3Client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: historyKey
    }));
    
    const chunks = [];
    for await (const chunk of getObjectResponse.Body) {
      chunks.push(chunk);
    }
    const historyData = Buffer.concat(chunks).toString('utf-8');
    return JSON.parse(historyData);
  } catch (error) {
    console.log('No existing history found, returning empty array');
    return [];
  }
}

// Save test history to S3
async function saveHistoryToS3(history) {
  const s3Client = await getS3Client();
  const bucketName = process.env.TESTS_BUCKET_NAME || 'vault22-tests';
  const historyKey = 'test-history.json';
  
  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: historyKey,
    Body: JSON.stringify(history, null, 2),
    ContentType: 'application/json'
  }));
}

exports.handler = async (event) => {
  console.log('Test History Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      // Return test history from S3
      const history = await loadHistoryFromS3();
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ history })
      };
      
    } else if (event.httpMethod === 'POST') {
      // Add new test history entry
      const body = JSON.parse(event.body || '{}');
      
      const newEntry = {
        id: body.id || `entry-${Date.now()}`,
        name: body.name || 'Unnamed Test',
        status: body.status || 'RUNNING',
        created: body.created || new Date().toISOString(),
        device: body.device || 'Unknown Device',
        platform: body.platform || 'unknown',
        build: body.build || 'unknown.apk',
        runArn: body.runArn,
        isDeviceFarm: body.isDeviceFarm || false,
        testMode: body.testMode,
        test: body.test,
        testCase: body.testCase
      };
      
      // Load existing history
      let history = await loadHistoryFromS3();
      
      // Add new entry at the beginning
      history.unshift(newEntry);
      
      // Keep only last 50 entries
      if (history.length > 50) {
        history = history.slice(0, 50);
      }
      
      // Save back to S3
      await saveHistoryToS3(history);
      
      console.log('Added test history entry:', newEntry.id);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true, entry: newEntry })
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Test history error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};