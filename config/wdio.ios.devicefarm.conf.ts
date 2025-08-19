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
    return path.join(__dirname, '..', 'apps', 'ios', 'Runner.app');
}

export const config = {
    ...sharedConfig,
    protocol: 'http',
    hostname: 'localhost',
    port: 4723,
    path: '/wd/hub',
    specs: [
        '../test/e2e/**/*.e2e.ts'
    ],
    // Use environment variable for test filtering
    ...(process.env.WDIO_GREP_PATTERN && {
        mochaOpts: {
            ...sharedConfig.mochaOpts,
            grep: process.env.WDIO_GREP_PATTERN
        }
    }),
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
        platformName: 'iOS',
        // Use Device Farm provided device info
        'appium:platformVersion': process.env.DEVICEFARM_DEVICE_OS_VERSION || process.env.IOS_VERSION,
        'appium:deviceName': process.env.DEVICEFARM_DEVICE_NAME || 'iPhone Device',
        'appium:udid': (() => {
            const udid = process.env.DEVICEFARM_DEVICE_UDID;
            const osVersion = process.env.DEVICEFARM_DEVICE_OS_VERSION;
            
            if (udid && osVersion) {
                const majorVersion = parseInt(osVersion.split('.')[0]);
                if (majorVersion <= 16) {
                    // For iOS 16 and below, remove hyphens
                    return udid.replace(/-/g, '');
                }
            }
            // For iOS 17+ or if version unknown, keep original UDID
            return udid;
        })(),
        // Use Device Farm app path
        'appium:app': getDeviceFarmAppPath(),
        'appium:automationName': 'XCUITest',
        'appium:noReset': false,
        'appium:fullReset': true,
        'appium:newCommandTimeout': 120,
        
        // Device Farm WebDriverAgent - let Device Farm handle automatically for Appium 2.x
        'appium:showXcodeLog': true,
        'appium:useNewWDA': false,
        
        // Device Farm WebDriverAgent configuration
        'appium:usePrebuiltWDA': true,
        'appium:derivedDataPath': process.env.DEVICEFARM_WDA_DERIVED_DATA_PATH || process.env.DEVICEFARM_WDA_DERIVED_DATA_PATH_V8,
        'appium:updatedWDABundleId': 'com.apple.test.WebDriverAgentRunner-Runner',
        
        // Device Farm specific settings  
        'appium:appWaitForLaunch': true,
        'appium:appWaitDuration': 30000,
        'appium:autoAcceptAlerts': true,
        'appium:autoDismissAlerts': true,
        'appium:autoGrantPermissions': true,
        
        // Handle iOS system interruptions
        'appium:interruptionsEnabled': false,
        'appium:shouldTerminateApp': false,
        
        // Performance optimizations for iOS Device Farm (proper settings format)
        'appium:settings[snapshotMaxDepth]': 5,
        'appium:settings[pageSourceExcludedAttributes]': 'visible,accessible'
    }],
    
    autoCompileOpts: {
        autoCompile: true,
        tsNodeOpts: {
            transpileOnly: true
        }
    },
    
    onPrepare: function () {
        console.log('=== Device Farm iOS Configuration ===');
        console.log('Device Name:', process.env.DEVICEFARM_DEVICE_NAME);
        console.log('Platform:', process.env.DEVICEFARM_DEVICE_PLATFORM_NAME);
        console.log('OS Version:', process.env.DEVICEFARM_DEVICE_OS_VERSION);
        console.log('App Path:', process.env.DEVICEFARM_APP_PATH);
        console.log('UDID:', process.env.DEVICEFARM_DEVICE_UDID);
        console.log('WDA Path V8:', process.env.DEVICEFARM_WDA_DERIVED_DATA_PATH_V8);
        console.log('=== WebDriverAgent Capabilities Debug ===');
        // Log the capabilities that should be used
        console.log('Expected usePrebuiltWDA: true');
        console.log('Expected usePreinstalledWDA: false');
        console.log('Expected derivedDataPath:', process.env.DEVICEFARM_WDA_DERIVED_DATA_PATH || process.env.DEVICEFARM_WDA_DERIVED_DATA_PATH_V8);
        console.log('Expected updatedWDABundleId: undefined (not set)');
    },
    
    beforeSession: function (_config, capabilities, _specs) {
        console.log('=== WebDriverIO Session Starting - Capabilities Debug ===');
        const caps = capabilities as any;
        console.log('📱 Device Details:');
        console.log('  platformName:', caps.platformName);
        console.log('  deviceName:', caps['appium:deviceName']);
        console.log('  platformVersion:', caps['appium:platformVersion']);
        console.log('  udid:', caps['appium:udid']);
        console.log('🔧 WebDriverAgent Configuration:');
        console.log('  usePrebuiltWDA:', caps['appium:usePrebuiltWDA']);
        console.log('  usePreinstalledWDA:', caps['appium:usePreinstalledWDA']);
        console.log('  derivedDataPath:', caps['appium:derivedDataPath']);
        console.log('  useNewWDA:', caps['appium:useNewWDA']);
        console.log('  updatedWDABundleId:', caps['appium:updatedWDABundleId']);
        console.log('  automationName:', caps['appium:automationName']);
        console.log('🚀 App Configuration:');
        console.log('  app:', caps['appium:app']);
        console.log('  fullReset:', caps['appium:fullReset']);
        console.log('  noReset:', caps['appium:noReset']);
    },
    
    beforeSuite: function (_suite) {
        // addEnvironment is deprecated in newer versions of @wdio/allure-reporter
        // Use reportedEnvironmentVars in reporter config instead
    }
} as Options.Testrunner;