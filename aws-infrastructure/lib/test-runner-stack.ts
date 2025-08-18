import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipelineActions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export class TestRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for static website hosting
    const websiteBucket = new s3.Bucket(this, 'TestRunnerUI', {
      bucketName: 'vault22-test-runner-ui',
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // SPA routing
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // S3 Bucket for app builds (APKs, IPAs)
    const buildsBucket = new s3.Bucket(this, 'BuildsStorage', {
      bucketName: 'vault22-builds',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // S3 Bucket for test packages (zipped test suites)
    const testsBucket = new s3.Bucket(this, 'TestsStorage', {
      bucketName: 'vault22-tests',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // S3 Bucket for test reports (Allure HTML reports)
    const reportsBucket = new s3.Bucket(this, 'ReportsStorage', {
      bucketName: 'vault22-test-reports',
      publicReadAccess: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false
      }),
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Parameter Store for AWS credentials (secure storage)
    const accessKeyParam = new ssm.StringParameter(this, 'AWSAccessKeyId', {
      parameterName: '/vault22/aws/access-key-id',
      stringValue: process.env.AWS_ACCESS_KEY_ID || 'PLACEHOLDER',
      description: 'AWS Access Key ID for Vault22 testing'
    });

    const secretKeyParam = new ssm.StringParameter(this, 'AWSSecretAccessKey', {
      parameterName: '/vault22/aws/secret-access-key',
      stringValue: process.env.AWS_SECRET_ACCESS_KEY || 'PLACEHOLDER', 
      description: 'AWS Secret Access Key for Vault22 testing'
    });

    const sessionTokenParam = new ssm.StringParameter(this, 'AWSSessionToken', {
      parameterName: '/vault22/aws/session-token',
      stringValue: process.env.AWS_SESSION_TOKEN || 'PLACEHOLDER',
      description: 'AWS Session Token for Vault22 testing'
    });

    // CodeBuild IAM Role for Device Farm integration
    const deviceFarmCodeBuildRole = new iam.Role(this, 'DeviceFarmCodeBuildRole', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com'),
      inlinePolicies: {
        DeviceFarmPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'devicefarm:*',
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
                's3:GetObject',
                's3:PutObject'
              ],
              resources: ['*']
            })
          ]
        })
      }
    });

    // CodeBuild project for Device Farm upload
    const deviceFarmCodeBuild = new codebuild.Project(this, 'DeviceFarmCodeBuild', {
      projectName: 'vault22-device-farm-upload',
      role: deviceFarmCodeBuildRole,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.LARGE, // 15 GB memory for large APK files
      },
      environmentVariables: {
        DEVICE_FARM_PROJECT_ARN: {
          value: process.env.DEVICE_FARM_PROJECT_ARN || 'arn:aws:devicefarm:us-west-2:859998284317:project:9a2e2485-4bd8-4b1a-af28-254326345350'
        },
        BUILDS_BUCKET_NAME: {
          value: buildsBucket.bucketName
        },
        TESTS_BUCKET_NAME: {
          value: testsBucket.bucketName
        }
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: 18
            },
            commands: [
              'echo Installing dependencies',
              'npm init -y',
              'npm install @aws-sdk/client-device-farm @aws-sdk/client-s3'
            ]
          },
          pre_build: {
            commands: [
              'echo Setting up environment for Device Farm upload',
              'echo "BUILD_FILE_PATH=$BUILD_FILE_PATH"',
              'echo "DEVICE_POOL_ARN=$DEVICE_POOL_ARN"',
              'echo "DEVICE_FARM_PROJECT_ARN=$DEVICE_FARM_PROJECT_ARN"',
              'echo "TEST_MODE=$TEST_MODE"',
              'echo "SELECTED_TEST=$SELECTED_TEST"',
              'echo "SELECTED_TEST_CASE=$SELECTED_TEST_CASE"'
            ]
          },
          build: {
            commands: [
              'echo Starting Device Farm upload and test execution',
              `cat > device-farm-upload.js << 'EOF'
const { 
  DeviceFarmClient,
  CreateUploadCommand,
  GetUploadCommand,
  ScheduleRunCommand
} = require('@aws-sdk/client-device-farm');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
// fetch is available globally in Node.js 18+

const deviceFarmClient = new DeviceFarmClient({ region: 'us-west-2' });
const s3Client = new S3Client({ region: 'eu-west-1' });

async function main() {
  try {
    const buildFilePath = process.env.BUILD_FILE_PATH;
    const devicePoolArn = process.env.DEVICE_POOL_ARN;
    const projectArn = process.env.DEVICE_FARM_PROJECT_ARN;
    
    if (!buildFilePath || !devicePoolArn || !projectArn) {
      throw new Error('Missing required environment variables');
    }

    console.log(\`Downloading build file: \${buildFilePath}\`);
    
    const fileName = path.basename(buildFilePath);
    const localPath = \`/tmp/\${fileName}\`;
    
    const s3Response = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.BUILDS_BUCKET_NAME,
      Key: buildFilePath
    }));
    
    const writeStream = fs.createWriteStream(localPath);
    
    // Handle the stream properly
    if (s3Response.Body.pipe) {
      s3Response.Body.pipe(writeStream);
    } else {
      // Handle as buffer if not streamable
      const chunks = [];
      for await (const chunk of s3Response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(localPath, buffer);
    }
    
    if (s3Response.Body.pipe) {
      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    }
    
    console.log(\`Downloaded \${fileName} successfully\`);
    
    console.log('Creating Device Farm upload...');
    const createUploadResponse = await deviceFarmClient.send(new CreateUploadCommand({
      projectArn,
      name: fileName,
      type: 'ANDROID_APP'
    }));
    
    const upload = createUploadResponse.upload;
    if (!upload || !upload.url) {
      throw new Error('Failed to create Device Farm upload');
    }
    
    console.log(\`Upload created: \${upload.arn}\`);
    
    const fileBuffer = fs.readFileSync(localPath);
    const uploadResponse = await fetch(upload.url, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });
    
    if (!uploadResponse.ok) {
      throw new Error(\`Upload failed: \${uploadResponse.status} \${uploadResponse.statusText}\`);
    }
    
    console.log('File uploaded to Device Farm, waiting for processing...');
    
    let uploadStatus = 'INITIALIZED';
    let attempts = 0;
    const maxAttempts = 30;
    
    while ((uploadStatus === 'INITIALIZED' || uploadStatus === 'PROCESSING') && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
      
      const getUploadResponse = await deviceFarmClient.send(new GetUploadCommand({ 
        arn: upload.arn 
      }));
      uploadStatus = getUploadResponse.upload?.status || 'FAILED';
      console.log(\`Upload status check \${attempts}/\${maxAttempts}: \${uploadStatus}\`);
    }
    
    if (uploadStatus !== 'SUCCEEDED') {
      throw new Error(\`Upload failed with status: \${uploadStatus}\`);
    }
    
    // Download and upload test package
    console.log('Downloading WebDriverIO test package...');
    const testPackageLocalPath = '/tmp/device-farm-test-package.zip';
    
    const testS3Response = await s3Client.send(new GetObjectCommand({
      Bucket: process.env.TESTS_BUCKET_NAME || 'vault22-tests',
      Key: 'device-farm-test-package.zip'
    }));
    
    // Handle test package download
    if (testS3Response.Body.pipe) {
      const testWriteStream = fs.createWriteStream(testPackageLocalPath);
      testS3Response.Body.pipe(testWriteStream);
      await new Promise((resolve, reject) => {
        testWriteStream.on('finish', resolve);
        testWriteStream.on('error', reject);
      });
    } else {
      const chunks = [];
      for await (const chunk of testS3Response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(testPackageLocalPath, buffer);
    }
    
    console.log('Uploading WebDriverIO test package to Device Farm...');
    const testCreateUploadResponse = await deviceFarmClient.send(new CreateUploadCommand({
      projectArn,
      name: 'device-farm-test-package.zip',
      type: 'APPIUM_NODE_TEST_PACKAGE'
    }));
    
    const testUpload = testCreateUploadResponse.upload;
    if (!testUpload || !testUpload.url) {
      throw new Error('Failed to create test package upload');
    }
    
    const testFileBuffer = fs.readFileSync(testPackageLocalPath);
    const testUploadResponse = await fetch(testUpload.url, {
      method: 'PUT',
      body: testFileBuffer,
      headers: {
        'Content-Type': 'application/zip'
      }
    });
    
    if (!testUploadResponse.ok) {
      throw new Error(\`Test package upload failed: \${testUploadResponse.status} \${testUploadResponse.statusText}\`);
    }
    
    // Wait for test upload to complete
    let testUploadStatus = 'INITIALIZED';
    let testAttempts = 0;
    const testMaxAttempts = 15;
    
    while ((testUploadStatus === 'INITIALIZED' || testUploadStatus === 'PROCESSING') && testAttempts < testMaxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      testAttempts++;
      
      const getTestUploadResponse = await deviceFarmClient.send(new GetUploadCommand({ 
        arn: testUpload.arn 
      }));
      testUploadStatus = getTestUploadResponse.upload?.status || 'FAILED';
      console.log(\`Test upload status check \${testAttempts}/\${testMaxAttempts}: \${testUploadStatus}\`);
    }
    
    if (testUploadStatus !== 'SUCCEEDED') {
      throw new Error(\`Test package upload failed with status: \${testUploadStatus}\`);
    }
    
    // Generate dynamic test spec file based on test selection
    console.log('Generating dynamic test spec file...');
    const testSpecLocalPath = '/tmp/device-farm-testspec.yml';
    
    // Create dynamic testspec content based on test selection
    let testSpecContent = \`version: 0.1

# Enable Amazon Linux 2 test host for Android (REQUIRED)
android_test_host: amazon_linux_2

# Phases represent collections of commands executed during test run
phases:
  # Install phase for dependencies
  install:
    commands:
      # Set up Node.js environment using devicefarm-cli
      - echo "=== Setting up Amazon Linux 2 environment ==="
      - devicefarm-cli use node 18
      - node --version
      - npm --version
      
      # Set up Appium using devicefarm-cli (NOTE: use 'appium 2' not 'appium 2.0')
      - echo "=== Installing Appium via devicefarm-cli ==="
      - devicefarm-cli use appium 2
      - appium --version
      
      # Install project dependencies (NOTE: use 'npm install' not 'npm ci')
      - echo "=== Installing test dependencies ==="
      - cd $DEVICEFARM_TEST_PACKAGE_PATH
      - npm install
      
      # Install TypeScript tools for test compilation
      - echo "=== Installing TypeScript tools ==="
      - npm install --no-save ts-node

  # Pre-test phase for setup
  pre_test:
    commands:
      - echo "=== Starting Appium Server ==="
      - echo "Device:" $DEVICEFARM_DEVICE_NAME  
      - echo "Platform:" $DEVICEFARM_DEVICE_PLATFORM_NAME $DEVICEFARM_DEVICE_OS_VERSION
      - echo "App:" $DEVICEFARM_APP_PATH
      - echo "UDID:" $DEVICEFARM_DEVICE_UDID
      
      # Start Appium server with proper capabilities for Amazon Linux 2
      - |
        appium --base-path=$APPIUM_BASE_PATH --log-timestamp \\\\
        --log-no-colors --relaxed-security --default-capabilities \\\\
        "{\\\\"appium:deviceName\\\\": \\\\"$DEVICEFARM_DEVICE_NAME\\\\", \\\\
        \\\\"platformName\\\\": \\\\"$DEVICEFARM_DEVICE_PLATFORM_NAME\\\\", \\\\
        \\\\"appium:app\\\\": \\\\"$DEVICEFARM_APP_PATH\\\\", \\\\
        \\\\"appium:udid\\\\":\\\\"$DEVICEFARM_DEVICE_UDID\\\\", \\\\
        \\\\"appium:platformVersion\\\\": \\\\"$DEVICEFARM_DEVICE_OS_VERSION\\\\", \\\\
        \\\\"appium:chromedriverExecutableDir\\\\": \\\\"$DEVICEFARM_CHROMEDRIVER_EXECUTABLE_DIR\\\\", \\\\
        \\\\"appium:automationName\\\\": \\\\"UiAutomator2\\\\"}" \\\\
        >> $DEVICEFARM_LOG_DIR/appium.log 2>&1 &
      
      # Wait for Appium to initialize with shorter timeout for testing
      - |
        echo "Waiting for Appium to start..."
        appium_initialization_time=0
        while [ $appium_initialization_time -lt 90 ]; do
          if curl -s http://localhost:4723/status | grep -q "ready"; then
            echo "✅ Appium is ready!"
            break
          fi
          appium_initialization_time=$((appium_initialization_time + 1))
          echo "⏳ Waiting for Appium... ($appium_initialization_time/90)"
          sleep 1
        done
        
        if [ $appium_initialization_time -eq 90 ]; then
          echo "❌ Appium failed to start within 90 seconds"
          echo "Checking Appium logs..."
          tail -20 $DEVICEFARM_LOG_DIR/appium.log || echo "No appium.log found"
          exit 1
        fi

  # Test execution phase
  test:
    commands:
      - echo "=== Running Tests ==="
      - cd $DEVICEFARM_TEST_PACKAGE_PATH
      
      # Set up TypeScript compilation for Device Farm
      - export TS_NODE_TRANSPILE_ONLY=true
      
      # Debug working directory and files
      - echo "Current directory:" $(pwd)
      - echo "Contents:" && ls -la
      - echo "Config directory contents:" && ls -la config/
      - echo "Looking for Device Farm config:" && ls -la config/wdio.android.devicefarm.conf.ts\`;

    // Add the complete test execution logic with conditional single/full test support
    testSpecContent += \`
      
      # Run WebdriverIO tests with dynamic test selection\`;
    
    if (process.env.TEST_MODE === 'single' && process.env.SELECTED_TEST) {
      console.log(\`🎯 Generating testspec for single test: \${process.env.SELECTED_TEST}\`);
      if (process.env.SELECTED_TEST_CASE) {
        console.log(\`🎯 With test case filter: \${process.env.SELECTED_TEST_CASE}\`);
      }
      
      testSpecContent += \`
      - |
        if [ "$DEVICEFARM_DEVICE_PLATFORM_NAME" = "Android" ]; then
          echo "🤖 Running Android WebdriverIO tests with Device Farm config"
          echo "Checking if config file exists..."
          if [ -f "config/wdio.android.devicefarm.conf.ts" ]; then
            echo "✅ Config file found, running tests..."
            
            echo "🎯 Running single test: \${process.env.SELECTED_TEST}"\`;
            
      if (process.env.SELECTED_TEST_CASE) {
        testSpecContent += \`
            echo "🎯 Running specific test case: \${process.env.SELECTED_TEST_CASE}"
            export WDIO_GREP_PATTERN="\${process.env.SELECTED_TEST_CASE}"
            echo "🔧 Set WDIO_GREP_PATTERN: $WDIO_GREP_PATTERN"\`;
      }
      
      testSpecContent += \`
            
            echo "Executing: npx wdio config/wdio.android.devicefarm.conf.ts --spec \${process.env.SELECTED_TEST}"
            npx wdio config/wdio.android.devicefarm.conf.ts --spec \${process.env.SELECTED_TEST}
          else
            echo "❌ Config file not found! Available configs:"
            ls -la config/
            exit 1
          fi
        else
          echo "🍎 Running iOS WebdriverIO tests"  
          npx wdio config/wdio.ios.conf.ts
        fi\`;
    } else {
      console.log('🏃 Generating testspec for full test suite');
      testSpecContent += \`
      - |
        if [ "$DEVICEFARM_DEVICE_PLATFORM_NAME" = "Android" ]; then
          echo "🤖 Running Android WebdriverIO tests with Device Farm config"
          echo "Checking if config file exists..."
          if [ -f "config/wdio.android.devicefarm.conf.ts" ]; then
            echo "✅ Config file found, running tests..."
            echo "🏃 Running full test suite"
            
            echo "Executing: npx wdio config/wdio.android.devicefarm.conf.ts"
            npx wdio config/wdio.android.devicefarm.conf.ts
          else
            echo "❌ Config file not found! Available configs:"
            ls -la config/
            exit 1
          fi
        else
          echo "🍎 Running iOS WebdriverIO tests"  
          npx wdio config/wdio.ios.conf.ts
        fi\`;
    }

    // Add complete post_test section and artifacts
    testSpecContent += \`

  # Post-test cleanup and reporting
  post_test:
    commands:
      - echo "=== Post-test cleanup ==="
      
      # Generate Allure report if available
      - |
        if [ -d "allure-results" ] && [ "$(ls -A allure-results 2>/dev/null)" ]; then
          echo "📊 Generating Allure report..."
          npm install -g allure-commandline
          echo "Generating single-file HTML report..."
          allure generate allure-results --clean --single-file -o allure-report
          echo "✅ Allure single-file report generated"
          
          # Also copy the single HTML file directly to log dir with a clear name
          if [ -f "allure-report/index.html" ]; then
            cp allure-report/index.html $DEVICEFARM_LOG_DIR/allure-report-complete.html
            echo "✅ Single HTML report copied to artifacts"
          fi
        else
          echo "⚠️ No Allure results found"
        fi
      
      # Copy artifacts to Device Farm log directory
      - |
        if [ -d "allure-report" ]; then
          cp -r allure-report $DEVICEFARM_LOG_DIR/ 2>/dev/null || echo "Could not copy allure-report"
        fi
        if [ -d "screenshots" ]; then
          cp -r screenshots $DEVICEFARM_LOG_DIR/ 2>/dev/null || echo "Could not copy screenshots"
        fi
      
      - echo "✅ Test execution completed"

# Artifacts to be collected by Device Farm
artifacts:
  - $DEVICEFARM_LOG_DIR
\`;

    console.log('Generated testspec content preview:');
    console.log(testSpecContent.substring(0, 500) + '...');
    
    // Write the generated testspec to file
    fs.writeFileSync(testSpecLocalPath, testSpecContent);
    
    console.log('=== GENERATED TESTSPEC CONTENT ===');
    console.log(testSpecContent);
    console.log('=== END TESTSPEC CONTENT ===');
    console.log('Testspec file size:', testSpecContent.length, 'characters');
    
    console.log('Uploading test spec to Device Farm...');
    const testSpecCreateUploadResponse = await deviceFarmClient.send(new CreateUploadCommand({
      projectArn,
      name: 'device-farm-testspec.yml',
      type: 'APPIUM_NODE_TEST_SPEC'
    }));
    
    const testSpecUpload = testSpecCreateUploadResponse.upload;
    if (!testSpecUpload || !testSpecUpload.url) {
      throw new Error('Failed to create test spec upload');
    }
    
    const testSpecFileBuffer = fs.readFileSync(testSpecLocalPath);
    const testSpecUploadResponse = await fetch(testSpecUpload.url, {
      method: 'PUT',
      body: testSpecFileBuffer,
      headers: {
        'Content-Type': 'text/yaml'
      }
    });
    
    if (!testSpecUploadResponse.ok) {
      throw new Error(\`Test spec upload failed: \${testSpecUploadResponse.status} \${testSpecUploadResponse.statusText}\`);
    }
    
    // Wait for test spec upload to complete
    let testSpecUploadStatus = 'INITIALIZED';
    let testSpecAttempts = 0;
    const testSpecMaxAttempts = 10;
    
    while ((testSpecUploadStatus === 'INITIALIZED' || testSpecUploadStatus === 'PROCESSING') && testSpecAttempts < testSpecMaxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      testSpecAttempts++;
      
      const getTestSpecUploadResponse = await deviceFarmClient.send(new GetUploadCommand({ 
        arn: testSpecUpload.arn 
      }));
      testSpecUploadStatus = getTestSpecUploadResponse.upload?.status || 'FAILED';
      console.log(\`Test spec upload status check \${testSpecAttempts}/\${testSpecMaxAttempts}: \${testSpecUploadStatus}\`);
    }
    
    if (testSpecUploadStatus !== 'SUCCEEDED') {
      throw new Error(\`Test spec upload failed with status: \${testSpecUploadStatus}\`);
    }
    
    console.log('Scheduling Device Farm WebDriverIO test run...');
    
    const scheduleRunResponse = await deviceFarmClient.send(new ScheduleRunCommand({
      projectArn,
      appArn: upload.arn,
      devicePoolArn,
      name: \`WebDriverIO Test - \${new Date().toISOString()}\`,
      test: {
        type: 'APPIUM_NODE',
        testPackageArn: testUpload.arn,
        testSpecArn: testSpecUpload.arn
      }
    }));
    
    const run = scheduleRunResponse.run;
    console.log(\`Test run scheduled: \${run?.arn}\`);
    console.log(\`Status: \${run?.status}\`);
    
    console.log('=== DEVICE FARM TEST SCHEDULED ===');
    console.log(\`Run ARN: \${run?.arn}\`);
    console.log(\`Status: \${run?.status}\`);
    console.log(\`Name: \${run?.name}\`);
    
  } catch (error) {
    console.error('Device Farm upload failed:', error);
    process.exit(1);
  }
}

main();
EOF`,
              'node device-farm-upload.js'
            ]
          },
          post_build: {
            commands: [
              'echo Device Farm upload and test scheduling completed'
            ]
          }
        },
        artifacts: {
          files: ['**/*']
        }
      })
    });

    // Grant CodeBuild access to S3 buckets
    buildsBucket.grantRead(deviceFarmCodeBuild);
    testsBucket.grantReadWrite(deviceFarmCodeBuild);

    // Lambda function to trigger CodeBuild for Device Farm
    const deviceFarmTriggerFunction = new lambda.Function(this, 'DeviceFarmTrigger', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-trigger.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2),
      environment: {
        CODEBUILD_PROJECT_NAME: deviceFarmCodeBuild.projectName
      }
    });

    // Helper function to grant STS assume role permissions
    const grantAssumeRolePermissions = (lambdaFunction: lambda.Function) => {
      lambdaFunction.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['sts:AssumeRole'],
        resources: ['arn:aws:iam::859998284317:role/testpolicy']
      }));
    };

    // Grant STS assume role permissions instead of Parameter Store
    grantAssumeRolePermissions(deviceFarmTriggerFunction);

    // Grant permissions to trigger CodeBuild
    deviceFarmTriggerFunction.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['codebuild:StartBuild'],
      resources: [deviceFarmCodeBuild.projectArn]
    }));

    // Lambda functions for API endpoints

    const deviceFarmStatusFunction = new lambda.Function(this, 'DeviceFarmStatus', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-status.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(5)
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(deviceFarmStatusFunction);

    const deviceFarmDevicesFunction = new lambda.Function(this, 'DeviceFarmDevices', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-devices.handler',
      code: lambda.Code.fromAsset('../lambda')
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(deviceFarmDevicesFunction);

    const deviceFarmSyncFunction = new lambda.Function(this, 'DeviceFarmSync', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-sync.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2)
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(deviceFarmSyncFunction);

    const deviceFarmRunningFunction = new lambda.Function(this, 'DeviceFarmRunning', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-running.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2)
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(deviceFarmRunningFunction);

    const deviceFarmReportFunction = new lambda.Function(this, 'DeviceFarmReport', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-report.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2)
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(deviceFarmReportFunction);

    const deviceFarmTestSuitesFunction = new lambda.Function(this, 'DeviceFarmTestSuites', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-test-suites.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2),
      environment: {
        TESTS_BUCKET_NAME: testsBucket.bucketName
      }
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(deviceFarmTestSuitesFunction);

    const deviceFarmUploadToS3Function = new lambda.Function(this, 'DeviceFarmUploadToS3', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-upload-to-s3.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(5)
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(deviceFarmUploadToS3Function);

    const deviceFarmExtractAndUploadFunction = new lambda.Function(this, 'DeviceFarmExtractAndUpload', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'device-farm-extract-and-upload.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(10)
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(deviceFarmExtractAndUploadFunction);

    const testHistoryFunction = new lambda.Function(this, 'TestHistory', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'test-history.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2)
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(testHistoryFunction);

    const buildsFunction = new lambda.Function(this, 'Builds', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'builds.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2),
      environment: {
        BUILDS_BUCKET_NAME: buildsBucket.bucketName
      }
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(buildsFunction);

    // Add Lambda function names to environment for device farm report function
    deviceFarmReportFunction.addEnvironment('UPLOAD_TO_S3_FUNCTION_NAME', deviceFarmUploadToS3Function.functionName);
    deviceFarmReportFunction.addEnvironment('EXTRACT_AND_UPLOAD_FUNCTION_NAME', deviceFarmExtractAndUploadFunction.functionName);

    // Grant permission for device farm report function to invoke upload functions
    deviceFarmUploadToS3Function.grantInvoke(deviceFarmReportFunction);
    deviceFarmExtractAndUploadFunction.grantInvoke(deviceFarmReportFunction);

    // Grant builds function read access to builds bucket
    buildsBucket.grantRead(buildsFunction);

    const buildsFetchFunction = new lambda.Function(this, 'BuildsFetch', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'builds-fetch.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        BUILDS_BUCKET_NAME: buildsBucket.bucketName
      }
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(buildsFetchFunction);

    // Grant builds fetch function write access to builds bucket
    buildsBucket.grantWrite(buildsFetchFunction);

    const testsFunction = new lambda.Function(this, 'Tests', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'tests.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(2),
      environment: {
        TESTS_BUCKET_NAME: testsBucket.bucketName
      }
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(testsFunction);

    // Grant tests function read access to tests bucket
    testsBucket.grantRead(testsFunction);
    testsBucket.grantRead(deviceFarmTestSuitesFunction);

    const testsUploadFunction = new lambda.Function(this, 'TestsUpload', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'tests-upload.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      environment: {
        TESTS_BUCKET_NAME: testsBucket.bucketName
      }
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(testsUploadFunction);

    // Grant tests upload function write access to tests bucket
    testsBucket.grantWrite(testsUploadFunction);

    const testRunFunction = new lambda.Function(this, 'TestRun', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'test-run.handler',
      code: lambda.Code.fromAsset('../lambda'),
      timeout: cdk.Duration.minutes(5)
    });

    // Grant STS assume role permissions
    grantAssumeRolePermissions(testRunFunction);

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
    deviceFarmResource.addResource('run').addMethod('POST', new apigateway.LambdaIntegration(deviceFarmTriggerFunction));
    deviceFarmResource.addResource('status').addMethod('GET', new apigateway.LambdaIntegration(deviceFarmStatusFunction));
    deviceFarmResource.addResource('sync').addMethod('GET', new apigateway.LambdaIntegration(deviceFarmSyncFunction));
    deviceFarmResource.addResource('running').addMethod('GET', new apigateway.LambdaIntegration(deviceFarmRunningFunction));
    deviceFarmResource.addResource('report').addMethod('GET', new apigateway.LambdaIntegration(deviceFarmReportFunction));
    deviceFarmResource.addResource('test-suites').addMethod('GET', new apigateway.LambdaIntegration(deviceFarmTestSuitesFunction));
    deviceFarmResource.addResource('upload-to-s3').addMethod('POST', new apigateway.LambdaIntegration(deviceFarmUploadToS3Function));
    deviceFarmResource.addResource('extract-and-upload').addMethod('POST', new apigateway.LambdaIntegration(deviceFarmExtractAndUploadFunction));
    const devicesResource = deviceFarmResource.addResource('devices');
    devicesResource.addMethod('GET', new apigateway.LambdaIntegration(deviceFarmDevicesFunction));
    devicesResource.addMethod('POST', new apigateway.LambdaIntegration(deviceFarmDevicesFunction));

    const testResource = apiRoot.addResource('test');
    const historyResource = testResource.addResource('history');
    historyResource.addMethod('GET', new apigateway.LambdaIntegration(testHistoryFunction));
    historyResource.addMethod('POST', new apigateway.LambdaIntegration(testHistoryFunction));
    
    const runResource = testResource.addResource('run');
    runResource.addMethod('GET', new apigateway.LambdaIntegration(testRunFunction));
    runResource.addMethod('POST', new apigateway.LambdaIntegration(testRunFunction));

    // Add missing root-level endpoints
    const buildsResource = apiRoot.addResource('builds');
    buildsResource.addMethod('GET', new apigateway.LambdaIntegration(buildsFunction));
    buildsResource.addResource('fetch').addMethod('POST', new apigateway.LambdaIntegration(buildsFetchFunction));
    
    const testsResource = apiRoot.addResource('tests');
    testsResource.addMethod('GET', new apigateway.LambdaIntegration(testsFunction));
    testsResource.addResource('upload').addMethod('POST', new apigateway.LambdaIntegration(testsUploadFunction));


    // TODO: Deploy static website after build
    // new s3deploy.BucketDeployment(this, 'DeployWebsite', {
    //   sources: [s3deploy.Source.asset('../test-runner-ui/out')],
    //   destinationBucket: websiteBucket,
    //   distribution,
    //   distributionPaths: ['/*']
    // });

    // Outputs
    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: websiteBucket.bucketWebsiteUrl,
      description: 'Test Runner UI URL (S3 Static Website)'
    });

    new cdk.CfnOutput(this, 'ApiURL', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new cdk.CfnOutput(this, 'BuildsBucketName', {
      value: buildsBucket.bucketName,
      description: 'S3 Bucket for uploading APK/IPA builds'
    });

    new cdk.CfnOutput(this, 'TestsBucketName', {
      value: testsBucket.bucketName,
      description: 'S3 Bucket for uploading test packages (ZIP files)'
    });

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 Bucket for static website hosting'
    });
  }
}