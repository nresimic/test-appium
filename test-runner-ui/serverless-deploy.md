# Deploy Test Runner UI to AWS (S3 + Lambda)

## Architecture
- **Frontend**: React app on S3 (static hosting)
- **Backend**: Lambda functions (replacing Next.js API routes)
- **API**: API Gateway (provides HTTP endpoints)

## Step 1: Convert API Routes to Lambda Functions

Each Next.js API route becomes a Lambda function:

```
app/api/device-farm/running/route.ts → lambda/device-farm-running.js
app/api/test/run/route.ts → lambda/test-run.js
```

## Step 2: Deploy Infrastructure

### Option A: AWS SAM (Recommended)
```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Timeout: 30
    Environment:
      Variables:
        DEVICE_FARM_PROJECT_ARN: !Ref DeviceFarmProjectArn
        AWS_REGION: eu-west-1

Resources:
  # S3 Bucket for Static Site
  WebsiteBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: mobile-automation-testing-ui
      WebsiteConfiguration:
        IndexDocument: index.html
      PublicAccessBlockConfiguration:
        BlockPublicPolicy: false

  # Lambda Function for Device Farm
  DeviceFarmRunningFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: lambda/
      Handler: device-farm-running.handler
      Runtime: nodejs18.x
      Events:
        Api:
          Type: Api
          Properties:
            Path: /api/device-farm/running
            Method: GET

  # API Gateway
  Api:
    Type: AWS::Serverless::Api
    Properties:
      StageName: prod
      Cors:
        AllowOrigin: "'*'"
```

### Option B: Use AWS CDK
```typescript
// cdk/stack.ts
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

const bucket = new s3.Bucket(this, 'WebsiteBucket', {
  websiteIndexDocument: 'index.html',
  publicReadAccess: true
});

const deviceFarmLambda = new lambda.Function(this, 'DeviceFarmFunction', {
  runtime: lambda.Runtime.NODEJS_18_X,
  handler: 'device-farm.handler',
  code: lambda.Code.fromAsset('lambda'),
  environment: {
    DEVICE_FARM_PROJECT_ARN: process.env.DEVICE_FARM_PROJECT_ARN!
  }
});

const api = new apigateway.RestApi(this, 'TestRunnerApi');
api.root.addResource('device-farm')
  .addResource('running')
  .addMethod('GET', new apigateway.LambdaIntegration(deviceFarmLambda));
```

## Step 3: Update Frontend Code

Change API calls from relative to absolute:

```javascript
// Before (Next.js API route)
const response = await fetch('/api/device-farm/running');

// After (API Gateway)
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://your-api.execute-api.eu-west-1.amazonaws.com/prod';
const response = await fetch(`${API_URL}/api/device-farm/running`);
```

## Step 4: Deploy

```bash
# Deploy backend (Lambda + API Gateway)
sam deploy --guided

# Build and deploy frontend to S3
npm run build
aws s3 sync out/ s3://mobile-automation-testing-ui --delete

# Get your API Gateway URL
aws apigateway get-rest-apis
```

## Estimated AWS Costs
- **S3**: ~$0.50/month (static hosting)
- **Lambda**: Free tier covers most usage
- **API Gateway**: $3.50 per million requests
- **Total**: ~$5-10/month for moderate usage

## Benefits
✅ Fully serverless (no servers to manage)
✅ Auto-scaling
✅ Pay only for what you use
✅ Secure (credentials in Lambda, not browser)
✅ Works with your existing S3 bucket

## Quick Alternative: AWS Amplify
If this seems complex, AWS Amplify can handle all of this automatically:
```bash
amplify init
amplify add hosting
amplify add function
amplify push
```