import path from 'path';
import { config as sharedConfig } from './wdio.shared.conf';
import type { Options } from '@wdio/types';

function getDeviceFarmAppPath(): string {
    const deviceFarmAppPath = process.env.DEVICEFARM_APP_PATH;
    
    if (deviceFarmAppPath) {
        console.log(`Using Device Farm app path: ${deviceFarmAppPath}`);
        return deviceFarmAppPath;
    }
    
    console.warn('DEVICEFARM_APP_PATH not found, using local fallback');
    return path.join(__dirname, '..', 'apps', 'android', 'app-UAE-main-build-52.apk');
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
            disableWebdriverStepsReporting: true, // Hide noisy WebDriver step names
            disableWebdriverScreenshotsReporting: true, // Disable automatic screenshots to prevent duplicates
            useCucumberStepReporter: false,
            addConsoleLogs: true,
            // This will still capture WebDriver commands as attachments to your custom steps
            disableMochaHooks: false
        }]
    ],
    // Device Farm specific capabilities
    capabilities: [{
        platformName: 'Android',
        // Use Device Farm provided device info
        'appium:platformVersion': process.env.DEVICEFARM_DEVICE_OS_VERSION || process.env.ANDROID_VERSION,
        'appium:deviceName': process.env.DEVICEFARM_DEVICE_NAME || 'Android Device',
        'appium:udid': process.env.DEVICEFARM_DEVICE_UDID,
        // Use Device Farm app path
        'appium:app': getDeviceFarmAppPath(),
        'appium:automationName': 'UiAutomator2',
        'appium:noReset': false,
        'appium:fullReset': false,
        'appium:newCommandTimeout': 240,
        // Device Farm specific settings
        'appium:appWaitForLaunch': true,
        'appium:appWaitDuration': 30000 
    }],
    
    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            transpileOnly: true
        }
    },
    
    onPrepare: function () {
        console.log('=== Device Farm Android Configuration ===');
        console.log('Device Name:', process.env.DEVICEFARM_DEVICE_NAME);
        console.log('Platform:', process.env.DEVICEFARM_DEVICE_PLATFORM_NAME);
        console.log('OS Version:', process.env.DEVICEFARM_DEVICE_OS_VERSION);
        console.log('App Path:', process.env.DEVICEFARM_APP_PATH);
        console.log('UDID:', process.env.DEVICEFARM_DEVICE_UDID);
    },
    
    beforeSuite: function (_suite) {
        // addEnvironment is deprecated in newer versions of @wdio/allure-reporter
        // Use reportedEnvironmentVars in reporter config instead
    }
} as Options.Testrunner;