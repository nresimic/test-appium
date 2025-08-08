import path from 'path';
import fs from 'fs';
import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';

/**
 * Get the latest APK from the apps/android directory
 * Falls back to a specific APK if USE_LATEST env var is not set
 */
function getAppPath(): string {
    const appsDir = path.join(__dirname, '..', 'apps', 'android');
    
    // Allow manual override via environment variable
    if (process.env.APK_NAME) {
        return path.join(appsDir, process.env.APK_NAME);
    }
    
    // Use latest APK if USE_LATEST is set
    if (process.env.USE_LATEST === 'true') {
        const files = fs.readdirSync(appsDir)
            .filter(file => file.endsWith('.apk'))
            .map(file => ({
                name: file,
                path: path.join(appsDir, file),
                time: fs.statSync(path.join(appsDir, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time);
        
        if (files.length > 0) {
            console.log(`Using latest APK: ${files[0].name}`);
            return files[0].path;
        }
    }
    
    // Default fallback
    const defaultApk = 'app-test.apk';
    console.log(`Using default APK: ${defaultApk}`);
    return path.join(appsDir, defaultApk);
}

export const config = {
    ...sharedConfig,
    port: 4723,
    specs: [
        '../test/e2e/**/*.e2e.ts'
    ],
    reporters: [
        'spec',
        ['allure', {
            outputDir: 'allure-results',
            disableWebdriverStepsReporting: true,
            disableWebdriverScreenshotsReporting: false,
            useCucumberStepReporter: false
        }]
    ],
    capabilities: [{
        platformName: 'Android',
        // Don't specify version to auto-detect, or use env variable
        ...(process.env.ANDROID_VERSION && { 'appium:platformVersion': process.env.ANDROID_VERSION }),
        'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'Android Emulator',
        'appium:app': getAppPath(),
        'appium:automationName': 'UiAutomator2',
        'appium:noReset': process.env.ANDROID_NO_RESET === 'true' ? true : false,
        'appium:fullReset': process.env.ANDROID_FULL_RESET === 'false' ? false : true,
        'appium:newCommandTimeout': 240,
        // Auto-detect first available device if not specified
        'appium:udid': process.env.ANDROID_UDID || undefined,
        'appium:avd': process.env.ANDROID_AVD || undefined,
        // App Launch Detection - Wait for app to be fully ready
        'appium:appWaitForLaunch': true,
        'appium:appWaitDuration': 20000  // Wait up to 20 seconds for app to launch
    }]
} as Options.Testrunner;