const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');
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

exports.handler = async (event) => {
  console.log('Builds Lambda called (S3 enabled):', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const bucketName = process.env.BUILDS_BUCKET_NAME;
    
    if (!bucketName) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Builds bucket not configured' })
      };
    }

    const s3Client = await getS3Client();
    
    console.log(`Listing builds from S3 bucket: ${bucketName}`);
    
    // List objects in the builds bucket
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 100
    });
    
    const response = await s3Client.send(command);
    const objects = response.Contents || [];
    
    console.log(`Found ${objects.length} objects in builds bucket`);
    
    // Filter and format build files
    const builds = objects
      .filter(obj => {
        const key = obj.Key || '';
        return key.endsWith('.apk') || key.endsWith('.ipa');
      })
      .map(obj => {
        const key = obj.Key || '';
        const filename = key.split('/').pop() || key;
        const platform = key.toLowerCase().includes('.apk') ? 'android' : 'ios';
        
        // Extract version from filename if possible
        const versionMatch = filename.match(/v?(\d+\.\d+\.\d+)/);
        const buildMatch = filename.match(/build[_-]?(\d+)/i);
        const version = versionMatch ? versionMatch[1] : (buildMatch ? `build-${buildMatch[1]}` : 'unknown');
        
        return {
          id: key.replace(/[/.]/g, '-'),
          filename,
          version,
          platform,
          size: obj.Size || 0,
          created: obj.LastModified?.toISOString() || new Date().toISOString(),
          path: key,
          s3Key: key
        };
      })
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

    console.log(`Returning ${builds.length} builds`);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        builds,
        bucketName,
        totalObjects: objects.length
      })
    };

  } catch (error) {
    console.error('Builds error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};