const { DeviceFarmClient, GetRunCommand } = require('@aws-sdk/client-device-farm');
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

exports.handler = async (event) => {
  console.log('Device Farm Status Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const client = await getDeviceFarmClient();
    const runArn = event.queryStringParameters?.runArn;
    
    if (!runArn) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing runArn parameter' })
      };
    }

    console.log(`Getting status for run: ${runArn}`);
    
    // For now, return mock status
    // TODO: Implement actual Device Farm status checking
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        status: 'COMPLETED',
        result: 'PASSED',
        counters: {
          total: 5,
          passed: 4,
          failed: 1,
          warned: 0,
          errored: 0,
          stopped: 0,
          skipped: 0
        },
        totalJobs: 1,
        completedJobs: 1,
        message: 'Test run completed',
        started: new Date(Date.now() - 300000).toISOString(),
        stopped: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Device Farm status error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};