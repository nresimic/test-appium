const { DeviceFarmClient, ListArtifactsCommand } = require('@aws-sdk/client-device-farm');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
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

const getLambdaClient = async () => {
  const credentials = await getCredentialsFromRole();
  return new LambdaClient({
    region: 'eu-west-1',
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

const checkIfReportExistsInS3 = async (runArn) => {
  try {
    const s3Client = await getS3Client();
    const runId = runArn.split('/').pop() || 'unknown';
    
    const consistentKey = `allure/device-farm-${runId}.html`;
    
    const headCommand = new HeadObjectCommand({
      Bucket: 'vault22-test-reports',
      Key: consistentKey
    });
    
    await s3Client.send(headCommand);
    
    return `https://vault22-test-reports.s3.eu-west-1.amazonaws.com/${consistentKey}`;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    console.error('Error checking S3 object:', error);
    return null;
  }
};

exports.handler = async (event) => {
  console.log('Device Farm Report Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod === 'GET') {
    try {
      const runArn = event.queryStringParameters?.runArn;
      
      if (!runArn) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ 
            error: 'Missing runArn parameter',
            hasReport: false
          })
        };
      }

      // First, check if report already exists in S3
      const existingS3Url = await checkIfReportExistsInS3(runArn);
      
      if (existingS3Url) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            hasReport: true,
            reportUrl: existingS3Url,
            reportName: 'Allure Report (S3)',
            message: 'Allure report already available in S3',
            artifactType: 'html',
            requiresExtraction: false,
            source: 's3-cached'
          })
        };
      }

      const deviceFarmClient = await getDeviceFarmClient();
      
      console.log(`Fetching artifacts for run: ${runArn}`);
      
      // List all artifacts for the run
      const listCommand = new ListArtifactsCommand({
        arn: runArn,
        type: 'FILE'
      });
      
      const { artifacts } = await deviceFarmClient.send(listCommand);
      
      if (!artifacts || artifacts.length === 0) {
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ 
            message: 'No artifacts found for this run',
            hasReport: false
          })
        };
      }
      
      console.log(`Found ${artifacts.length} artifacts for run`);
      artifacts.forEach((artifact, index) => {
        console.log(`  ${index + 1}. ${artifact.name} (${artifact.type}, .${artifact.extension})`);
      });
      
      // Look for single HTML file first
      const singleHtmlReport = artifacts.find(artifact => 
        artifact.name?.includes('allure-report-complete.html')
      );
      
      if (singleHtmlReport?.url) {
        console.log(`Found Allure report: ${singleHtmlReport.name}`);
        
        // Try to upload to S3 automatically
        try {
          console.log('🚀 Found Allure report, attempting S3 upload...');
          
          const lambdaClient = await getLambdaClient();
          
          const invokeCommand = new InvokeCommand({
            FunctionName: process.env.UPLOAD_TO_S3_FUNCTION_NAME,
            Payload: JSON.stringify({
              httpMethod: 'POST',
              body: JSON.stringify({ runArn })
            })
          });
          
          const response = await lambdaClient.send(invokeCommand);
          const responsePayload = JSON.parse(new TextDecoder().decode(response.Payload));
          
          console.log(`📊 Upload response status: ${responsePayload.statusCode}`);
          
          if (responsePayload.statusCode === 200) {
            const uploadData = JSON.parse(responsePayload.body);
            console.log('📤 Upload response data:', uploadData);
            
            if (uploadData.success && uploadData.s3Url) {
              console.log('✅ Auto-uploaded to S3:', uploadData.s3Url);
              return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                  hasReport: true,
                  reportUrl: uploadData.s3Url,
                  reportName: 'Allure Report (S3)',
                  message: 'Allure report auto-uploaded to S3',
                  artifactType: 'html',
                  requiresExtraction: false,
                  source: 's3-auto'
                })
              };
            } else {
              console.log('❌ Upload succeeded but no S3 URL returned');
            }
          } else {
            console.log(`❌ Upload failed: ${responsePayload.statusCode} - ${responsePayload.body}`);
          }
          
          console.log('⚠️ S3 upload failed, falling back to Device Farm URL');
        } catch (error) {
          console.error('💥 S3 upload error:', error);
        }
        
        // Fallback to direct Device Farm URL
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            hasReport: true,
            reportUrl: singleHtmlReport.url,
            reportName: singleHtmlReport.name,
            message: 'Single-file Allure report available (Device Farm)',
            artifactType: 'html',
            requiresExtraction: false,
            source: 'device-farm'
          })
        };
      }
      
      // Check Customer Artifacts zip for allure report
      const customerArtifactsZip = artifacts.find(artifact => 
        (artifact.name?.includes('Customer Artifacts') && artifact.extension === 'zip')
      );
      
      if (customerArtifactsZip?.url) {
        console.log(`Found Customer Artifacts zip: ${customerArtifactsZip.name}`);
        
        // Try to extract and upload the HTML report from the zip
        try {
          console.log('Found Customer Artifacts, attempting to extract Allure report...');
          
          const lambdaClient = await getLambdaClient();
          
          const invokeCommand = new InvokeCommand({
            FunctionName: process.env.EXTRACT_AND_UPLOAD_FUNCTION_NAME,
            Payload: JSON.stringify({
              httpMethod: 'POST',
              body: JSON.stringify({ 
                zipUrl: customerArtifactsZip.url,
                runArn 
              })
            })
          });
          
          const response = await lambdaClient.send(invokeCommand);
          const responsePayload = JSON.parse(new TextDecoder().decode(response.Payload));
          
          if (responsePayload.statusCode === 200) {
            const uploadData = JSON.parse(responsePayload.body);
            if (uploadData.success && uploadData.s3Url) {
              console.log('✅ Extracted and uploaded to S3:', uploadData.s3Url);
              return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                  hasReport: true,
                  reportUrl: uploadData.s3Url,
                  reportName: 'Allure Report (S3)',
                  message: 'Allure report extracted and uploaded to S3',
                  artifactType: 'html',
                  requiresExtraction: false,
                  source: 's3-extracted'
                })
              };
            }
          }
          
          console.log('Extraction failed, offering zip download');
        } catch (error) {
          console.error('Extraction error:', error);
        }
        
        // Fallback: offer zip download
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            hasReport: true,
            reportUrl: customerArtifactsZip.url,
            reportName: customerArtifactsZip.name,
            message: 'Customer artifacts available (contains Allure report)',
            artifactType: 'zip',
            requiresExtraction: true,
            source: 'device-farm',
            instructions: 'Download and extract the zip file, then open Host_Machine_Files/$DEVICEFARM_LOG_DIR/allure-report-complete.html in your browser'
          })
        };
      }
      
      console.log('No Allure report found - available artifacts:');
      artifacts.forEach(artifact => {
        console.log(`  - ${artifact.name} (${artifact.type}, .${artifact.extension})`);
      });
      
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          hasReport: false,
          message: 'No Allure report found in artifacts',
          availableArtifacts: artifacts.map(a => ({
            name: a.name,
            type: a.type,
            extension: a.extension,
            url: a.url
          }))
        })
      };
      
    } catch (error) {
      console.error('Failed to fetch report:', error);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: error.message,
          hasReport: false
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};