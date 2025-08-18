const { CodeBuildClient, StartBuildCommand } = require('@aws-sdk/client-codebuild');
const { getCredentialsFromRole } = require('./aws-credentials-role');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

const getCodeBuildClient = async () => {
  const credentials = await getCredentialsFromRole();
  return new CodeBuildClient({
    region: 'eu-west-1',
    credentials
  });
};

exports.handler = async (event) => {
  console.log('Device Farm Trigger Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { 
        projectArn,
        devicePoolArn,
        platform,
        buildPath,
        testMode,
        testSuite: selectedTestSuite,
        testCase: selectedTestCase
      } = body;
      
      if (!projectArn || !devicePoolArn || !buildPath) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Missing required parameters: projectArn, devicePoolArn, buildPath' })
        };
      }
      
      console.log('Triggering CodeBuild for Device Farm with parameters:', {
        projectArn,
        devicePoolArn,
        platform,
        buildPath
      });
      
      const client = await getCodeBuildClient();
      
      // Start CodeBuild with environment variables
      const command = new StartBuildCommand({
        projectName: process.env.CODEBUILD_PROJECT_NAME,
        environmentVariablesOverride: [
          {
            name: 'BUILD_FILE_PATH',
            value: buildPath
          },
          {
            name: 'DEVICE_POOL_ARN',
            value: devicePoolArn
          },
          {
            name: 'DEVICE_FARM_PROJECT_ARN',
            value: projectArn
          },
          {
            name: 'PLATFORM',
            value: platform || 'android'
          },
          {
            name: 'TEST_MODE',
            value: testMode || 'full'
          },
          {
            name: 'SELECTED_TEST',
            value: selectedTestSuite || ''
          },
          {
            name: 'SELECTED_TEST_CASE',
            value: selectedTestCase || ''
          }
        ]
      });
      
      const response = await client.send(command);
      const build = response.build;
      
      if (!build?.id) {
        throw new Error('Failed to start CodeBuild');
      }
      
      console.log(`CodeBuild started: ${build.id}`);
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          buildId: build.id,
          buildArn: build.arn,
          status: build.buildStatus,
          message: 'Device Farm test build started successfully. The test will run on AWS CodeBuild with 15GB memory.',
          // Return a mock runArn for frontend compatibility
          runArn: `codebuild:${build.id}`
        })
      };
      
    } catch (error) {
      console.error('Failed to trigger Device Farm CodeBuild:', error);
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