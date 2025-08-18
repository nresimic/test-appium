const { DeviceFarmClient, ListRunsCommand } = require('@aws-sdk/client-device-farm');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
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
  console.log('Device Farm Sync Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    try {
      const projectArn = 'arn:aws:devicefarm:us-west-2:859998284317:project:9a2e2485-4bd8-4b1a-af28-254326345350';
      
      const deviceFarmClient = await getDeviceFarmClient();
      const s3Client = await getS3Client();
      
      console.log('Fetching Device Farm runs...');
      
      // List all runs in the project
      const listCommand = new ListRunsCommand({
        arn: projectArn
      });
      
      const { runs } = await deviceFarmClient.send(listCommand);
      
      if (!runs || runs.length === 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'No tests found in Device Farm',
            synced: 0
          })
        };
      }
      
      // Load existing history from S3
      const bucketName = process.env.TESTS_BUCKET_NAME || 'vault22-tests';
      const historyKey = 'test-history.json';
      let history = [];
      
      try {
        const getObjectResponse = await s3Client.send(new GetObjectCommand({
          Bucket: bucketName,
          Key: historyKey
        }));
        
        const chunks = [];
        for await (const chunk of getObjectResponse.Body) {
          chunks.push(chunk);
        }
        const historyData = Buffer.concat(chunks).toString('utf-8');
        history = JSON.parse(historyData);
      } catch (error) {
        console.log('No existing history found, starting fresh');
      }
      
      let syncedCount = 0;
      let addedCount = 0;
      
      // Filter to only completed runs
      const completedRuns = runs.filter(run => run.status === 'COMPLETED');
      
      console.log(`Found ${runs.length} total runs, ${completedRuns.length} completed runs`);
      
      // Process each completed Device Farm run
      for (const run of completedRuns) {
        const runId = run.arn?.split('/').pop() || `df-${Date.now()}`;
        const existingIndex = history.findIndex(h => 
          h.runArn === run.arn || h.id === runId
        );
        
        const duration = run.started && run.stopped
          ? Math.round((new Date(run.stopped).getTime() - new Date(run.started).getTime()) / 1000)
          : 0;
        
        const historyEntry = {
          id: runId,
          name: run.name?.includes('Test Run') 
            ? 'Device Farm Test' 
            : run.name || 'Device Farm Test',
          status: run.status || 'UNKNOWN',
          result: run.result,
          created: run.created?.toISOString() || new Date().toISOString(),
          duration: run.status === 'COMPLETED' ? duration : undefined,
          device: 'AWS Device Farm',
          platform: run.platform?.toLowerCase() === 'android_app' ? 'android' : 'ios',
          build: 'app.apk',
          runArn: run.arn,
          isDeviceFarm: true,
          hasAllureReport: run.status === 'COMPLETED'
        };
        
        if (existingIndex >= 0) {
          // Update existing entry
          history[existingIndex] = {
            ...history[existingIndex],
            ...historyEntry,
            // Preserve some fields from the original entry
            name: history[existingIndex].name || historyEntry.name,
            test: history[existingIndex].test,
            testCase: history[existingIndex].testCase
          };
          syncedCount++;
        } else {
          // Add new entry at the beginning
          history.unshift(historyEntry);
          addedCount++;
        }
      }
      
      // Sort by created date (newest first)
      history.sort((a, b) => 
        new Date(b.created).getTime() - new Date(a.created).getTime()
      );
      
      // Limit history to 100 entries
      if (history.length > 100) {
        history = history.slice(0, 100);
      }
      
      // Save updated history to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: historyKey,
        Body: JSON.stringify(history, null, 2),
        ContentType: 'application/json'
      }));
      
      console.log(`Synced ${syncedCount} and added ${addedCount} completed Device Farm tests`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: `Synced ${syncedCount} and added ${addedCount} completed Device Farm tests`,
          synced: syncedCount,
          added: addedCount,
          total: completedRuns.length,
          totalRuns: runs.length
        })
      };
      
    } catch (error) {
      console.error('Failed to sync Device Farm data:', error);
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