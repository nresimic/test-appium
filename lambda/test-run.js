const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

exports.handler = async (event) => {
  console.log('Test Run Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
      // Return currently running tests
      const runningTests = [
        {
          id: 'run-12345',
          name: 'Login E2E Test',
          status: 'RUNNING',
          created: new Date().toISOString(),
          platform: 'android',
          device: 'Samsung Galaxy S21',
          location: 'local'
        }
      ];

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ runningTests })
      };
    }

    if (event.httpMethod === 'POST') {
      // Start a new test run
      const body = JSON.parse(event.body || '{}');
      const { testFile, build, device, platform } = body;

      const runId = `run-${Date.now()}`;
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ 
          runId,
          status: 'STARTED',
          message: 'Test run initiated successfully'
        })
      };
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Test Run error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};