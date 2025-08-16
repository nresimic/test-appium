import type { Options } from '@wdio/types';
import { captureDebugInfo } from '../test/utils/debug.utils';

declare const driver: WebdriverIO.Browser;

export const config: Options.Testrunner = {
    runner: 'local',
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 120000,
        // Support tag filtering via grep pattern
        grep: process.env.WDIO_TAG || undefined
    },
    logLevel: 'error', // Reduce logging to only errors
    bail: 0,
    waitforTimeout: 30000, // Standard timeout for element waits
    connectionRetryTimeout: 120000, // Standard connection timeout
    connectionRetryCount: 3,
    services: [],
    reporters: ['spec'],
    
    maxInstances: 1,
    
    // Support for test tags
    // Tags can be passed via command line: --mochaOpts.grep "@ios|@smoke"
    // Or via environment variable: WDIO_TAG="@ios"
    
    beforeSession: function (_config, capabilities, _specs) {
        const caps = capabilities as any;
        console.log(`Starting ${caps.platformName || caps['appium:platformName'] || 'unknown'} test session...`);
    },
    
    afterTest: async function(test, _context, { error, passed }) {
        if (!passed) {
            // Capture comprehensive debug information on failure
            const capabilities = browser.capabilities as any;
            const deviceName = capabilities.deviceName || capabilities['appium:deviceName'] || 'unknown';
            const platform = capabilities.platformName || capabilities['appium:platformName'] || 'unknown';
            
            await captureDebugInfo({
                testName: test.title,
                testFile: test.file,
                error: error,
                platform: platform,
                deviceName: deviceName
            });
        }
    }
};