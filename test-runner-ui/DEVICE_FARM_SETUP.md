# AWS Device Farm Setup Guide

## Prerequisites

1. **AWS Account**: You need an AWS account with Device Farm access
2. **AWS CLI** (optional but helpful): `brew install awscli`

## Step 1: Get AWS Credentials

1. Go to AWS Console: https://console.aws.amazon.com/
2. Navigate to IAM → Users → Your User → Security credentials
3. Create new Access Key
4. Save the Access Key ID and Secret Access Key

## Step 2: Set Up Device Farm Project

1. Go to AWS Device Farm: https://console.aws.amazon.com/devicefarm/
2. Select region: **US West (Oregon)** - Device Farm is only available in us-west-2
3. Click "Create a new project"
4. Name it (e.g., "Vault22 Mobile Tests")
5. Copy the Project ARN (looks like: `arn:aws:devicefarm:us-west-2:123456789012:project:abc-def-ghi`)

## Step 3: Create Device Pools

1. In your project, go to "Device pools"
2. Create a new device pool for Android:
   - Name: "Android Test Devices"
   - Add rules to include devices (e.g., Platform: ANDROID, OS Version: >= 11)
3. Create another for iOS:
   - Name: "iOS Test Devices"
   - Add rules (e.g., Platform: IOS, OS Version: >= 14)
4. Copy the Device Pool ARNs

## Step 4: Configure Local Environment

1. Copy the example env file:
```bash
cp test-runner-ui/.env.local.example test-runner-ui/.env.local
```

2. Edit `test-runner-ui/.env.local`:
```env
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
DEVICE_FARM_PROJECT_ARN=arn:aws:devicefarm:us-west-2:123456789012:project:abc-def-ghi
DEVICE_FARM_ANDROID_POOL_ARN=arn:aws:devicefarm:us-west-2:123456789012:devicepool:pool-id-android
DEVICE_FARM_IOS_POOL_ARN=arn:aws:devicefarm:us-west-2:123456789012:devicepool:pool-id-ios
```

3. Restart the Next.js server to load the env variables:
```bash
# Stop the current server (Ctrl+C)
# Start it again
cd test-runner-ui && npm run dev
```

## Step 5: Test the Connection

1. Open the UI at http://localhost:3001
2. Select "AWS Device Farm" as the run location
3. Choose your platform, build, and test configuration
4. Click "Run Test"

## Testing Without Real AWS Account

For testing purposes without a real AWS account, you can:

### Option 1: Use LocalStack (AWS emulator)
```bash
# Install LocalStack
pip install localstack

# Start LocalStack with Device Farm
localstack start -d

# Configure your .env.local to use LocalStack
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_ENDPOINT_URL=http://localhost:4566
```

### Option 2: Mock Mode
We can add a mock mode to simulate Device Farm responses without actual AWS calls.

## Troubleshooting

### Common Issues:

1. **"Invalid credentials"**: Check your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
2. **"Project not found"**: Verify the PROJECT_ARN is correct
3. **"Region error"**: Device Farm only works in us-west-2
4. **"Permission denied"**: Your AWS user needs Device Farm permissions

### Required IAM Permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "devicefarm:*"
      ],
      "Resource": "*"
    }
  ]
}
```

## Costs

AWS Device Farm charges:
- **Per device minute**: ~$0.17/minute for real devices
- **Uploads**: Free (included in test time)
- **Free tier**: 1000 device minutes for first-time users

## Next Steps

Once configured, your tests will:
1. Upload your APK/IPA to Device Farm
2. Upload your test bundle
3. Run tests on real devices in AWS cloud
4. Return results and artifacts back to your UI