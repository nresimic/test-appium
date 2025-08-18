const { DeviceFarmClient, ListRunsCommand, GetRunCommand } = require('@aws-sdk/client-device-farm');
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
  console.log('Device Farm Running Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    try {
      const deviceFarmClient = await getDeviceFarmClient();
      const projectArn = 'arn:aws:devicefarm:us-west-2:859998284317:project:9a2e2485-4bd8-4b1a-af28-254326345350';
      
      console.log('Fetching running Device Farm tests...');
      
      // Get recent runs from Device Farm
      const listRunsResponse = await deviceFarmClient.send(new ListRunsCommand({
        arn: projectArn,
        nextToken: undefined
      }));
      
      const runs = listRunsResponse.runs || [];
      console.log(`Found ${runs.length} total runs`);
      
      // Filter for currently running tests
      const runningTests = runs
        .filter(run => {
          const status = run.status;
          return status === 'PENDING' || status === 'PENDING_CONCURRENCY' || 
                 status === 'PENDING_DEVICE' || status === 'PROCESSING' || 
                 status === 'SCHEDULING' || status === 'PREPARING' || 
                 status === 'RUNNING' || status === 'PENDING_DEVICE';
        })
        .map(run => ({
          id: run.arn,
          name: run.name || 'Unnamed Test',
          status: run.status,
          platform: run.platform || 'ANDROID',
          type: run.type || 'APPIUM_NODE',
          created: run.created ? run.created.toISOString() : new Date().toISOString(),
          started: run.started ? run.started.toISOString() : null,
          devicePoolArn: run.devicePoolArn,
          deviceMinutes: run.deviceMinutes,
          totalJobs: run.totalJobs || 0,
          completedJobs: run.completedJobs || 0,
          counters: run.counters || { total: 0, passed: 0, failed: 0, errored: 0, warned: 0, skipped: 0, stopped: 0 },
          result: run.result,
          arn: run.arn
        }))
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
      
      console.log(`Found ${runningTests.length} running tests`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          runningTests,
          totalRuns: runs.length,
          message: runningTests.length === 0 ? 
            'No currently running Device Farm tests' : 
            `Found ${runningTests.length} running tests`
        })
      };
      
    } catch (error) {
      console.error('Failed to get running Device Farm tests:', error);
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