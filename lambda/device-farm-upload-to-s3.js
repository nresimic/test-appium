const { DeviceFarmClient, ListArtifactsCommand } = require('@aws-sdk/client-device-farm');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getCredentialsFromRole } = require('./aws-credentials-role');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

const getDeviceFarmClient = async () => {
  const credentials = await getCredentialsFromRole();
  return new DeviceFarmClient({
    region: 'us-west-2',
    credentials
  });
};

const getS3Client = async () => {
  const credentials = await getCredentialsFromRole();
  return new S3Client({
    region: 'eu-west-1',
    credentials
  });
};

exports.handler = async (event) => {
  console.log('Device Farm Upload to S3 Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { runArn } = body;
      
      if (!runArn) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing runArn parameter' })
        };
      }
      
      console.log('Starting S3 upload for Device Farm run:', runArn);
      
      const deviceFarmClient = await getDeviceFarmClient();
      const s3Client = await getS3Client();
      
      // List artifacts for the run
      const listCommand = new ListArtifactsCommand({
        arn: runArn,
        type: 'FILE'
      });
      
      const { artifacts } = await deviceFarmClient.send(listCommand);
      
      if (!artifacts || artifacts.length === 0) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No artifacts found for this run' })
        };
      }
      
      // Look for the single HTML Allure report
      const allureReport = artifacts.find(artifact => 
        artifact.name?.includes('allure-report-complete.html')
      );
      
      if (!allureReport?.url) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No Allure report found in artifacts' })
        };
      }
      
      console.log('Found Allure report, downloading:', allureReport.name);
      
      // Download the HTML report
      const response = await fetch(allureReport.url);
      if (!response.ok) {
        throw new Error(`Failed to download report: ${response.statusText}`);
      }
      
      const htmlContent = await response.text();
      
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
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          success: true,
          s3Url,
          message: 'Allure report uploaded to S3 successfully'
        })
      };
      
    } catch (error) {
      console.error('Failed to upload report to S3:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};