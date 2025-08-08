# Mobile Test Automation Setup

This project uses WebdriverIO with Appium for mobile test automation on Android and iOS.

## Prerequisites

### System Requirements
- Node.js 18+ 
- Java 8+ (for Appium)
- Git

### Platform-Specific Requirements

#### Android
- Android Studio with SDK
- Android SDK Platform Tools
- Android Emulator or physical device
- Set `ANDROID_HOME` environment variable

#### iOS (macOS only)
- Xcode with Command Line Tools
- iOS Simulator
- Carthage: `brew install carthage`

## Quick Setup

### 1. Clone and Install
```bash
git clone <repository-url>
cd vault22-testing
npm install
```

### 2. Install Appium and Drivers
```bash
npm run appium:install
```

### 3. Setup Environment
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

### 4. Verify Setup
```bash
npm run setup:check
```

### 5. Download Latest Build
```bash
npm run build:fetch
```

## Running Tests

### Start Appium Server
```bash
npm run appium:start
```

### Run Tests
```bash
# Android tests
npm run test:android

# iOS tests (macOS only)  
npm run test:ios

# Specific test file
npm run test:android -- --spec="test/e2e/login.e2e.ts"
```

### Stop Appium Server
```bash
npm run appium:stop
```

## Build Management

```bash
# Check latest available build
npm run build:check

# Download latest build from CI
npm run build:fetch

# List downloaded builds
npm run build:list
```

## Reports

```bash
# Generate Allure report
npm run allure:generate

# Open report in browser
npm run allure:open

# Generate and serve report
npm run allure:serve
```

## Environment Variables

Set these in your `.env` file:

```env
# Build Selection
USE_LATEST=true              # Auto-select newest APK/app

# Bitrise Integration  
BITRISE_API_TOKEN=your-token
BITRISE_APP_SLUG=your-slug
BRANCH=develop

# Device Configuration (Optional - uses smart defaults)
ANDROID_DEVICE_NAME=Pixel_8   # Default: Android Emulator
IOS_DEVICE_NAME=iPhone 15 Pro  # Default: iPhone 15
```

### Device Configuration

The framework automatically handles device selection:

1. **Default Behavior**: Uses first available device/emulator
2. **Environment Variables**: Override via `.env` or command line
3. **Command Line**: `ANDROID_DEVICE_NAME="Galaxy S24" npm run test:android`

Examples:
```bash
# Use specific Android device
ANDROID_DEVICE_NAME="Pixel_8_Pro" ANDROID_VERSION="14" npm run test:android

# Use specific iOS simulator  
IOS_DEVICE_NAME="iPhone 15 Pro" IOS_VERSION="17.2" npm run test:ios

# Use first available device (default)
npm run test:android
```

## Troubleshooting

### Common Issues

1. **Appium server not starting**
   - Check if port 4723 is free: `lsof -i:4723`
   - Kill existing processes: `npm run appium:stop`

2. **Android device not detected**
   - Check `adb devices`
   - Verify ANDROID_HOME is set
   - Run `npm run setup:check`

3. **iOS simulator issues**
   - Ensure Xcode is installed
   - Try resetting simulator
   - Check iOS simulator is running

4. **Build not found**
   - Run `npm run build:fetch` to download latest
   - Check `apps/android/` directory exists
   - Verify Bitrise configuration in `.env`

### Doctor Commands

```bash
# Check Appium setup
npm run appium:doctor

# Check system requirements
npm run setup:check
```

## Project Structure

```
├── test/
│   ├── e2e/                 # Test files
│   ├── screen-objects/      # Page Object Model
│   └── data/               # Test data
├── config/                 # WebdriverIO configurations
├── apps/android/           # APK files
├── services/               # Bitrise integration
├── scripts/                # Utility scripts
└── allure-results/         # Test reports
```

## Tips

- Use `USE_LATEST=true` to always use the newest APK
- Run `npm run build:check` to see which build you're using
- Use specific test files during development: `--spec="test/e2e/login.e2e.ts"`
- Check logs in `allure-results/` for debugging