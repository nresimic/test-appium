import path from 'path';
import fs from 'fs';
import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';

/**
 * Get the latest iOS app from the apps/ios directory
 */
function getAppPath(): string {
    const appsDir = path.join(__dirname, '..', 'apps', 'ios');
    
    // Allow manual override via environment variable
    if (process.env.IOS_APP_NAME) {
        return path.join(appsDir, process.env.IOS_APP_NAME);
    }
    
    // Use latest app if USE_LATEST is set
    if (process.env.USE_LATEST === 'true') {
        const files = fs.readdirSync(appsDir)
            .filter(file => file.endsWith('.app'))
            .map(file => ({
                name: file,
                path: path.join(appsDir, file),
                time: fs.statSync(path.join(appsDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
        
        if (files.length > 0) {
            console.log(`Using latest iOS app: ${files[0].name}`);
            return files[0].path;
        }
    }
    
    // Default fallback
    const defaultApp = 'Runner.app';
    console.log(`Using default iOS app: ${defaultApp}`);
    return path.join(appsDir, defaultApp);
}

export const config = {
    ...sharedConfig,
    port: 4723,
    specs: ['../test/e2e/**/*.e2e.ts'],
    reporters: [
        'spec',
        ['allure', {
            outputDir: 'allure-results',
            disableWebdriverStepsReporting: true, // Hide noisy WebDriver step names
            disableWebdriverScreenshotsReporting: true, // Disable automatic screenshots to prevent duplicates
            useCucumberStepReporter: false,
            addConsoleLogs: true,
            // This will still capture WebDriver commands as attachments to your custom steps
            disableMochaHooks: false
        }]
    ],
    capabilities: [{
        // Core iOS Configuration
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        
        // Device Selection Strategy (in priority order):
        // 1. Use specific UDID if provided (fastest, most reliable)
        // 2. Match by device name + version (creates/reuses simulator)
        // 3. Default to iPhone 15 with iOS 17.0
        ...(process.env.IOS_UDID && { 'appium:udid': process.env.IOS_UDID }),
        'appium:deviceName': process.env.IOS_DEVICE_NAME || 'iPhone 15',
        'appium:platformVersion': process.env.IOS_VERSION || '17.0',
        
        // App Configuration
        'appium:app': getAppPath(),
        
        // Reset Behavior
        'appium:noReset': process.env.IOS_NO_RESET === 'true' ? true : false,
        'appium:fullReset': process.env.IOS_FULL_RESET === 'true' ? true : false,
        
        // Performance Optimizations (Industry Best Practices)
        'appium:usePrecompiledWDA': true,  // Skip WDA compilation (30-60s faster)
        'appium:useNewWDA': false,          // Reuse existing WDA installation
        'appium:shouldUseSingletonTestManager': true,  // Reuse test manager
        'appium:waitForIdleTimeout': 0,     // Disable UI idle waiting
        
        // App Launch Detection - Appium waits for app to be fully ready
        'appium:appWaitForLaunch': true,    // Wait for app to fully launch before proceeding
        
        // iOS Permission Handling - Auto-accept notifications
        'appium:autoAcceptAlerts': true,    // Automatically accept all iOS permission dialogs
        
        // Timeout Configuration (Production Values)
        'appium:newCommandTimeout': 240,
        'appium:simulatorStartupTimeout': 300000,  // 5 minutes (handles cold boot)
        'appium:wdaLaunchTimeout': 90000,          // 90 seconds for WDA
        'appium:wdaConnectionTimeout': 240000,     // 4 minutes for connection
        'appium:wdaStartupRetries': 3,             // Retry WDA startup 3 times
        'appium:wdaStartupRetryInterval': 15000,   // 15 seconds between retries
        
        // Simulator Management
        'appium:shutdownOtherSimulators': process.env.CI === 'true' ? true : false,  // Only in CI
        'appium:enforceFreshSimulatorCreation': false,  // Reuse existing simulators
        
        // Debugging
        'appium:showXcodeLog': process.env.DEBUG === 'true' ? true : false,
        'appium:showIOSLog': process.env.DEBUG === 'true' ? true : false
    }]
} as Options.Testrunner;