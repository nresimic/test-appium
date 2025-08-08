import type { Options } from '@wdio/types';

declare const driver: WebdriverIO.Browser;

export const config: Options.Testrunner = {
    runner: 'local',
    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 60000
    },
    logLevel: 'info',
    bail: 0,
    waitforTimeout: 30000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    services: [],
    reporters: ['spec'],
    
    maxInstances: 1,
    
    beforeSession: function (_config, capabilities, _specs) {
        console.log(`Starting ${(capabilities as any).platformName} test session...`);
    },
    
    afterTest: async function(test, _context, { passed }) {
        if (!passed) {
            const platform = (driver.capabilities.platformName as string).toLowerCase();
            await driver.saveScreenshot(`./reports/screenshots/${platform}-failed-${test.title.replace(/ /g, '-')}.png`);
        }
    }
};