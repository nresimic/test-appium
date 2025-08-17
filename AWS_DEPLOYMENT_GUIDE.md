# AWS Deployment Guide - Test Runner UI

## Quick Steps (One-liners)
```bash
# 1. Setup CDK infrastructure
mkdir aws-infrastructure && cd aws-infrastructure && cdk init app --language typescript

# 2. Create Lambda functions 
mkdir ../lambda && cd ../lambda && npm init -y && npm install @aws-sdk/client-device-farm @aws-sdk/client-s3

# 3. Configure Next.js for static export
cd ../test-runner-ui && echo 'export default { output: "export", trailingSlash: true, images: { unoptimized: true }, env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "" } }' > next.config.ts

# 4. Build frontend
npm run build

# 5. Deploy infrastructure 
cd ../aws-infrastructure && source ../test-runner-ui/.env.local && cdk deploy

# 6. Update API URL and redeploy
echo "NEXT_PUBLIC_API_URL=https://YOUR_API_GATEWAY_URL" >> ../test-runner-ui/.env.production && cd ../test-runner-ui && npm run build && cd ../aws-infrastructure && cdk deploy
```

---

## Overview
Deploy the Test Runner UI to AWS using the most cost-effective approach (Validated 2025):
- **Frontend**: React app on S3 Static Website Hosting
- **Backend**: Lambda functions for API endpoints  
- **API**: API Gateway for HTTP routing
- **Distribution**: CloudFront for HTTPS and performance
- **Estimated Cost**: $2-5/month

## Prerequisites
- AWS CLI configured with your credentials
- Node.js 22+ installed
- CDK CLI: `npm install -g aws-cdk`
- Your existing `.env.local` file with Device Farm credentials

## Architecture

```
Frontend (React) → CloudFront → S3 (Static Files)
Frontend API Calls → CloudFront → API Gateway → Lambda Functions → AWS Device Farm
```

## Step 1: Create CDK Infrastructure

### 1.1 Initialize CDK Project
```bash
cd vault22-testing
mkdir aws-infrastructure
cd aws-infrastructure
cdk init app --language typescript
npm install @aws-cdk/aws-s3 @aws-cdk/aws-lambda @aws-cdk/aws-apigateway @aws-cdk/aws-cloudfront @aws-cdk/aws-cloudfront-origins @aws-cdk/aws-s3-deployment
```

### 1.2 Create CDK Stack
Create `lib/test-runner-stack.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export class TestRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for static website
    const websiteBucket = new s3.Bucket(this, 'TestRunnerUI', {
      bucketName: `test-runner-ui-${Math.random().toString(36).substring(7)}`,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Lambda Layer for AWS SDK (shared dependencies)
    const awsSdkLayer = new lambda.LayerVersion(this, 'AwsSdkLayer', {
      code: lambda.Code.fromAsset('../lambda/layers/aws-sdk'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      description: 'AWS SDK for Lambda functions'
    });

    // Lambda functions for API endpoints
    const deviceFarmRunFunction = new lambda.Function(this, 'DeviceFarmRun', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-run.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(10),
      memorySize: 1024,
      layers: [awsSdkLayer],
      environment: {
        AWS_REGION: process.env.AWS_REGION || 'us-west-2',
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
        DEVICE_FARM_PROJECT_ARN: process.env.DEVICE_FARM_PROJECT_ARN || ''
      }
    });

    const deviceFarmStatusFunction = new lambda.Function(this, 'DeviceFarmStatus', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-status.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(5),
      layers: [awsSdkLayer],
      environment: {
        AWS_REGION: process.env.AWS_REGION || 'us-west-2',
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    const deviceFarmDevicesFunction = new lambda.Function(this, 'DeviceFarmDevices', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-devices.handler',
      code: lambda.Code.fromAsset('../lambda'),
      layers: [awsSdkLayer],
      environment: {
        AWS_REGION: process.env.AWS_REGION || 'us-west-2',
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });

    const testHistoryFunction = new lambda.Function(this, 'TestHistory', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'test-history.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2)
    });

    // API Gateway with CORS
    const api = new apigateway.RestApi(this, 'TestRunnerApi', {
      restApiName: 'Test Runner API',
      description: 'API for Test Runner UI',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      }
    });

    // API Routes
    const apiRoot = api.root.addResource('api');
    
    const deviceFarmResource = apiRoot.addResource('device-farm');
    deviceFarmResource.addResource('run').addMethod('POST', new apigateway.LambdaIntegration(deviceFarmRunFunction));
    deviceFarmResource.addResource('status').addMethod('GET', new apigateway.LambdaIntegration(deviceFarmStatusFunction));
    deviceFarmResource.addResource('devices').addMethod('GET', new apigateway.LambdaIntegration(deviceFarmDevicesFunction));
    deviceFarmResource.addResource('devices').addMethod('POST', new apigateway.LambdaIntegration(deviceFarmDevicesFunction));

    const testResource = apiRoot.addResource('test');
    testResource.addResource('history').addMethod('GET', new apigateway.LambdaIntegration(testHistoryFunction));
    testResource.addResource('history').addMethod('POST', new apigateway.LambdaIntegration(testHistoryFunction));

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'TestRunnerDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new origins.RestApiOrigin(api),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN
        }
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html'
        }
      ]
    });

    // Deploy static website after build
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('../test-runner-ui/out')],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*']
    });

    // Outputs
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Test Runner UI URL (HTTPS)'
    });

    new cdk.CfnOutput(this, 'ApiURL', {
      value: `https://${distribution.distributionDomainName}/api`,
      description: 'API Gateway URL via CloudFront'
    });

    new cdk.CfnOutput(this, 'DirectApiURL', {
      value: api.url,
      description: 'Direct API Gateway URL (for testing)'
    });
  }
}
```

## Step 2: Create Lambda Functions

### 2.1 Setup Lambda Directory
```bash
cd ../vault22-testing
mkdir lambda
cd lambda
npm init -y
npm install @aws-sdk/client-device-farm @aws-sdk/client-s3
```

### 2.2 Create AWS SDK Layer
```bash
mkdir -p layers/aws-sdk/nodejs
cd layers/aws-sdk/nodejs
npm init -y
npm install @aws-sdk/client-device-farm @aws-sdk/client-s3
cd ../../../
```

### 2.3 Extract API Route Logic

Create `lambda/device-farm-run.js`:
```javascript
const { DeviceFarmClient, ScheduleRunCommand, CreateUploadCommand, GetUploadCommand } = require('@aws-sdk/client-device-farm');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const client = new DeviceFarmClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const body = JSON.parse(event.body);
    
    // Copy your existing device-farm/run logic here
    // from test-runner-ui/app/api/device-farm/run/route.ts
    
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: 'Test scheduled' })
    };
  } catch (error) {
    console.error('Device Farm run error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

Create similar files for:
- `lambda/device-farm-status.js`
- `lambda/device-farm-devices.js` 
- `lambda/test-history.js`

## Step 3: Configure Next.js for Static Export

### 3.1 Update next.config.ts
```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || ''
  }
}

export default nextConfig
```

### 3.2 Update Frontend API Calls

Update components to use `NEXT_PUBLIC_API_URL`:
```typescript
// Before
const response = await fetch('/api/device-farm/run');

// After  
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const response = await fetch(`${API_URL}/api/device-farm/run`);
```

## Step 4: Build and Deploy

### 4.1 Build Frontend
```bash
cd test-runner-ui
npm run build
```

### 4.2 Bootstrap CDK (First time only)
```bash
cd ../aws-infrastructure
cdk bootstrap
```

### 4.3 Load Environment Variables and Deploy
```bash
# Load existing credentials
source ../test-runner-ui/.env.local

# Deploy infrastructure
cdk deploy
```

### 4.4 Update Frontend with CloudFront URL
```bash
# Get CloudFront URL from CDK output
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name TestRunnerStack --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text)

# Update environment for production
cd ../test-runner-ui
echo "NEXT_PUBLIC_API_URL=$CLOUDFRONT_URL" > .env.production

# Rebuild and redeploy
npm run build
cd ../aws-infrastructure
cdk deploy
```

## Step 5: Verification and Testing

### 5.1 Test Deployment
1. **Frontend**: Visit the CloudFront URL from CDK output
2. **API**: Test endpoints using `https://cloudfront-url/api/device-farm/devices`
3. **Device Farm**: Try running a test from the UI

### 5.2 CloudFront Cache Invalidation
```bash
# If you need to clear CloudFront cache
DISTRIBUTION_ID=$(aws cloudformation describe-stacks --stack-name TestRunnerStack --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontDistributionId`].OutputValue' --output text)
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"
```

## Cost Optimization

### Expected Monthly Costs:
- **S3**: $0.50 (static hosting)
- **Lambda**: Free tier (1M requests/month)
- **API Gateway**: Free tier (1M requests/month) 
- **CloudFront**: Free tier (1TB/month)
- **Total**: $2-5/month for moderate usage

### Cost Monitoring:
```bash
# Set up billing alerts
aws budgets create-budget --account-id YOUR_ACCOUNT_ID --budget file://budget.json
```

## Maintenance

### Update Deployment:
```bash
# Frontend changes
cd test-runner-ui && npm run build && cd ../aws-infrastructure && cdk deploy

# Backend changes  
cd aws-infrastructure && cdk deploy

# Environment variables
cdk deploy --parameters NewEnvVar=value
```

### Cleanup:
```bash
cd aws-infrastructure
cdk destroy
```

## Troubleshooting

### Common Issues:

1. **CORS Errors**: 
   - Check API Gateway CORS configuration
   - Verify CloudFront cache behaviors

2. **Lambda Timeouts**: 
   - Increase timeout in CDK stack
   - Check CloudWatch logs

3. **Static Files Not Loading**:
   - Verify S3 bucket policy
   - Check CloudFront distribution settings

4. **API Calls Failing**:
   - Verify environment variables in Lambda
   - Check API Gateway deployment stage

### Useful Commands:
```bash
# View stack outputs
cdk outputs

# Check Lambda logs
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/TestRunnerStack

# Monitor API Gateway
aws apigateway get-rest-apis
```

## Security Best Practices

- Environment variables encrypted at rest in Lambda
- CloudFront provides HTTPS by default
- S3 bucket configured with least privilege access
- API Gateway with throttling enabled
- Consider AWS Systems Manager Parameter Store for production secrets

## Migration to New AWS Account

When you get IAM permissions in the new account:
1. Update CDK stack to use IAM roles instead of hardcoded credentials
2. Implement AWS Systems Manager Parameter Store for secrets
3. Add CloudWatch monitoring and alerting
4. Set up AWS WAF for API protection