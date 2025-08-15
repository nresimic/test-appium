import type { Options } from '@wdio/types';
import { captureDebugInfo } from '../test/utils/debug.utils';

declare const driver: WebdriverIO.Browser;

export const config: Options.Testrunner = {
    runner: 'local',
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 120000
    },
    logLevel: 'error', // Reduce logging to only errors
    bail: 0,
    waitforTimeout: 30000, // Standard timeout for element waits
    connectionRetryTimeout: 120000, // Standard connection timeout
    connectionRetryCount: 3,
    services: [],
    reporters: ['spec'],
    
    maxInstances: 1,
    
    beforeSession: function (_config, capabilities, _specs) {
        console.log(`Starting ${(capabilities as any).platformName} test session...`);
    },
    
    afterTest: async function(test, _context, { error, passed }) {
        if (!passed) {
            // Capture comprehensive debug information on failure
            const capabilities = browser.capabilities as any;
            await captureDebugInfo({
                testName: test.title,
                testFile: test.file,
                error: error,
                platform: capabilities.platformName,
                deviceName: capabilities.deviceName || capabilities['appium:deviceName']
            });
        }
    }
};