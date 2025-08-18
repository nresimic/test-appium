const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'device-farm-test-package.zip');
const PROJECT_ROOT = path.join(__dirname, '..');

console.log('Creating Device Farm test package...');

// Remove existing package
if (fs.existsSync(OUTPUT_FILE)) {
  fs.unlinkSync(OUTPUT_FILE);
}

const output = fs.createWriteStream(OUTPUT_FILE);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`✅ Package created: ${OUTPUT_FILE}`);
  console.log(`📦 Total bytes: ${archive.pointer()}`);
  console.log(`📁 Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

archive.on('error', (err) => {
  console.error('❌ Error creating package:', err);
  throw err;
});

archive.pipe(output);

// Add essential files for Device Farm
console.log('📁 Adding files to package...');

// Package.json for dependencies
archive.file(path.join(PROJECT_ROOT, 'package.json'), { name: 'package.json' });

// WebDriverIO configurations  
archive.file(path.join(PROJECT_ROOT, 'config/wdio.android.devicefarm.conf.ts'), { name: 'config/wdio.android.devicefarm.conf.ts' });
archive.file(path.join(PROJECT_ROOT, 'config/wdio.shared.conf.ts'), { name: 'config/wdio.shared.conf.ts' });

// TypeScript config
archive.file(path.join(PROJECT_ROOT, 'tsconfig.json'), { name: 'tsconfig.json' });

// Test files
archive.directory(path.join(PROJECT_ROOT, 'test'), 'test');

// Device Farm test spec
const deviceFarmTestSpec = `version: 0.1

phases:
  install:
    runtime-versions:
      nodejs: 18
    commands:
      - echo "Installing test dependencies..."
      - npm install
      
  pre_test:
    commands:
      - echo "Setting up test environment..."
      - echo "Device Name:" $DEVICEFARM_DEVICE_NAME
      - echo "Platform:" $DEVICEFARM_DEVICE_PLATFORM_NAME  
      - echo "OS Version:" $DEVICEFARM_DEVICE_OS_VERSION
      - echo "App Path:" $DEVICEFARM_APP_PATH
      - echo "Test Selection:" $TEST_MODE
      
  test:
    commands:
      - echo "Starting WebDriverIO tests..."
      - |
        if [ "$TEST_MODE" = "single" ] && [ -n "$SELECTED_TEST" ]; then
          echo "Running single test: $SELECTED_TEST"
          if [ -n "$SELECTED_TEST_CASE" ]; then
            echo "Test case: $SELECTED_TEST_CASE"
            npx wdio config/wdio.android.devicefarm.conf.ts --spec="$SELECTED_TEST" --grep="$SELECTED_TEST_CASE"
          else
            npx wdio config/wdio.android.devicefarm.conf.ts --spec="$SELECTED_TEST"
          fi
        else
          echo "Running full test suite"
          npx wdio config/wdio.android.devicefarm.conf.ts
        fi
        
  post_test:
    commands:
      - echo "Test execution completed"
      - echo "Collecting artifacts..."

artifacts:
  - allure-results/**/*
  - reports/**/*
  - screenshots/**/*
  - logs/**/*
`;

// Add the test spec
archive.append(deviceFarmTestSpec, { name: 'testspec.yml' });

console.log('✅ Added package.json');
console.log('✅ Added WebDriverIO configs');
console.log('✅ Added test directory');
console.log('✅ Added Device Farm test spec');

archive.finalize();