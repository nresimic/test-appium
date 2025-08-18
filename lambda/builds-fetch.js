const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
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

const uploadToS3 = async (bucketName, key, filePath, platform) => {
  const s3Client = await getS3Client();
  
  try {
    const fileContent = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: platform === 'android' ? 'application/vnd.android.package-archive' : 'application/octet-stream',
      Metadata: {
        platform: platform,
        uploadedAt: new Date().toISOString(),
        originalName: path.basename(filePath),
        size: stats.size.toString()
      }
    });
    
    await s3Client.send(command);
    console.log(`Successfully uploaded ${key} to S3 bucket ${bucketName}`);
    return true;
  } catch (error) {
    console.error(`Failed to upload ${key} to S3:`, error);
    return false;
  }
};

const fetchBuildsFromBitrise = async () => {
  // This would be the existing build fetching logic
  // For now, return mock data - you can implement actual Bitrise API calls
  return [
    {
      filename: 'vault22-android-latest.apk',
      platform: 'android',
      downloadUrl: 'https://mock-download-url.com/vault22-android-latest.apk',
      version: 'latest',
      buildNumber: Date.now().toString()
    }
  ];
};

exports.handler = async (event) => {
  console.log('Builds Fetch Lambda called:', JSON.stringify(event, null, 2));

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
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

    console.log('Fetching latest builds and uploading to S3...');
    
    // Fetch builds from your CI/CD system (Bitrise, etc.)
    const availableBuilds = await fetchBuildsFromBitrise();
    
    const uploadResults = [];
    
    for (const build of availableBuilds) {
      try {
        // For AWS deployment, we'll download and upload to S3
        // For local development, this would save to local builds folder
        
        console.log(`Processing build: ${build.filename}`);
        
        // Generate S3 key with timestamp to avoid overwrites
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const s3Key = `${build.platform}/${timestamp}-${build.filename}`;
        
        // In a real implementation, you would:
        // 1. Download the build file from Bitrise/CI system
        // 2. Upload to S3
        
        // For now, create a placeholder file (in real implementation, download actual build)
        const tempFilePath = `/tmp/${build.filename}`;
        const placeholderContent = `Mock build file for ${build.filename} - ${timestamp}`;
        fs.writeFileSync(tempFilePath, placeholderContent);
        
        const uploadSuccess = await uploadToS3(bucketName, s3Key, tempFilePath, build.platform);
        
        if (uploadSuccess) {
          uploadResults.push({
            filename: build.filename,
            s3Key: s3Key,
            platform: build.platform,
            status: 'success'
          });
        } else {
          uploadResults.push({
            filename: build.filename,
            platform: build.platform,
            status: 'failed'
          });
        }
        
        // Clean up temp file
        fs.unlinkSync(tempFilePath);
        
      } catch (error) {
        console.error(`Failed to process build ${build.filename}:`, error);
        uploadResults.push({
          filename: build.filename,
          platform: build.platform,
          status: 'failed',
          error: error.message
        });
      }
    }
    
    const successCount = uploadResults.filter(r => r.status === 'success').length;
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Fetched and uploaded ${successCount}/${uploadResults.length} builds to S3`,
        bucketName,
        results: uploadResults
      })
    };

  } catch (error) {
    console.error('Builds fetch error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};